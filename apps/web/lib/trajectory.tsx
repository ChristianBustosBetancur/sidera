"use client";

import type { CourseId, VersionCourseId } from "@sidera/curriculum-domain";
import { deriveVersionCourseState, programRecord, recordTrajectory, recordContext, previewAcademicMark, previewDualActivation, deactivateDual, type AcademicRecords, type AcademicPreview, type FreeChoiceEntry, type SharedConflict, type CurriculumEvaluationContext, type DerivedCourseState, type StudentTrajectory, type TrajectoryReconciliation } from "@sidera/curriculum-engine";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { programs, programModels, verifiedShared, type AcademicProgramData } from "./programs";
import { emptyAcademicRecords, loadAcademicRecords, saveAcademicRecords } from "./academic-storage";
import { AcademicChangeDialog } from "./academic-change-dialog";
import { DualDeactivationDialog } from "./dual-deactivation-dialog";
import { defaultSyncPreferences, loadSyncPreferences, saveSyncPreferences } from "./sync-preferences";
import { requirementShortfall, syncNoticeText } from "./sync-notice";
import { markSharedRepairDone, repairNoticeText, repairSharedFacts, sharedRepairDone } from "./shared-fact-repair";
import { freeChoiceEntriesOf, withFreeChoiceEntry, withoutFreeChoiceEntry } from "./free-choice-entries";
import noticeStyles from "./sync-notice.module.css";

export type Mark = "UNMARKED" | "IN_PROGRESS" | "COMPLETED";
type Pending =
  | { kind: "mark" | "activation"; preview: AcademicPreview; conflicts: SharedConflict[] }
  | { kind: "deactivation" };
type TrajectoryContextValue = {
  trajectory: StudentTrajectory;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  evaluationContext: CurriculumEvaluationContext;
  program: AcademicProgramData;
  records: AcademicRecords;
  setProgram: (id: string) => void;
  markCourse: (id: VersionCourseId, mark: Mark) => TrajectoryReconciliation;
  previewMarkCourse: (id: VersionCourseId, mark: Mark) => TrajectoryReconciliation;
  markExternal: (id: CourseId, completed: boolean) => void;
  toggleDual: () => void;
  /** Con la Doble Titulación activa, omitir el diálogo de previsualización. */
  skipSharedConfirmation: boolean;
  setSkipSharedConfirmation: (skip: boolean) => void;
  setOriginProgram: (id: string) => void;
  /** Asignaturas declaradas de Libre Elección en el programa activo. */
  freeChoiceEntries: readonly FreeChoiceEntry[];
  saveFreeChoiceEntry: (entry: FreeChoiceEntry) => void;
  removeFreeChoiceEntry: (id: string) => void;
  ready: boolean;
};
const TrajectoryContext = createContext<TrajectoryContextValue | undefined>(undefined);

export function TrajectoryProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState(emptyAcademicRecords);
  const [ready, setReady] = useState(false);
  const [writable, setWritable] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Mark>>({});
  const [preferences, setPreferences] = useState(defaultSyncPreferences);
  const [remember, setRemember] = useState(false);
  const [originChoice, setOriginChoice] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    const loaded = loadAcademicRecords();
    /* Reparación de los planes simulados que la reconciliación anterior vació.
       Se aplica siempre porque es idempotente: una vez guardada no encuentra
       nada que restaurar. Hacerlo así la vuelve inmune a que el efecto se
       ejecute dos veces y a que un guardado falle. La clave propia no decide
       si se repara, sino si se anuncia: el aviso se da una sola vez. */
    const repair = repairSharedFacts(loaded.records, programModels);
    if (repair.restored.length > 0 && !sharedRepairDone()) {
      const text = repairNoticeText(repair.restored, id => programs.find(entry => entry.id === id)?.label ?? id);
      if (text) setNotice({ text, id: Date.now() });
    }
    setRecords(repair.records);
    setWritable(loaded.writable);
    setStorageError(!loaded.writable);
    setPreferences(loadSyncPreferences());
    setReady(true);
  }, []);
  // El aviso se retira solo: informa de algo ya aplicado y no espera respuesta.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!ready || !writable) return;
    const saved = saveAcademicRecords(records);
    setStorageError(!saved);
    // La reparación se da por hecha cuando el estado reparado está guardado,
    // no antes: si el guardado falla, el próximo arranque vuelve a intentarlo.
    if (saved) markSharedRepairDone();
  }, [records, ready, writable]);
  const program = programs.find(program => program.id === records.activeProgram) ?? programs[0]!;
  const record = programRecord(records, { id: program.id, context: program.evaluationContext });
  const trajectory = useMemo(() => recordTrajectory(record, program.evaluationContext), [record, program]);
  const evaluationContext = useMemo(() => recordContext(record, program.evaluationContext), [record, program]);
  const states = useMemo(() => new Map(program.snapshot.versionCourses.map(course => [course.id, deriveVersionCourseState(course.id, evaluationContext, trajectory).state])), [program, evaluationContext, trajectory]);
  const cancel = useCallback(() => { setPending(null); setResolutions({}); setRemember(false); setOriginChoice(null); }, []);
  const changePreferences = useCallback((skip: boolean) => {
    const next = { skipSharedConfirmation: skip };
    setPreferences(next);
    saveSyncPreferences(next);
  }, []);
  // Qué contar de un cambio ya aplicado: dónde más se reflejó y qué arrastró
  // consigo. Solo se anuncia con los planes vinculados; sin Doble Titulación
  // el comportamiento es el de siempre, en silencio.
  function announce(preview: AcademicPreview) {
    const mirrored = [...new Set(preview.changes.filter(change => change.programId !== program.id).map(change => change.programId))]
      .map(id => programs.find(entry => entry.id === id)?.label ?? id);
    const retired: string[] = [];
    const warned: string[] = [];
    for (const entry of preview.reconciliations) {
      const affected = programs.find(candidate => candidate.id === entry.programId);
      if (!affected) continue;
      for (const item of entry.result.invalidations) retired.push(affected.courseReference(item.versionCourseId));
      for (const item of entry.result.warnings) {
        const detail = requirementShortfall(affected.blockingReasonsFromNodes(item.blocking));
        const kept = item.mark === "IN_PROGRESS" ? " se mantiene «En curso»" : "";
        warned.push(`En ${affected.label}: ${affected.courseReference(item.versionCourseId)}${kept}${detail ? ` · ${detail}` : ""}.`);
      }
    }
    const text = syncNoticeText({ mirrored, retired, warned });
    if (text) setNotice({ text, id: Date.now() });
  }
  function apply(preview: AcademicPreview) {
    if (!ready || pending) return;
    // Volver a marcar lo ya marcado no cambia nada: ni diálogo ni aviso.
    const untouched = preview.changes.length === 0
      && preview.reconciliations.every(entry => entry.result.invalidations.length === 0);
    if (untouched) return;
    const quiet = records.dual && preferences.skipSharedConfirmation;
    if (preview.requiresConfirmation && !quiet) { setPending({ kind: "mark", preview, conflicts: [] }); return; }
    setRecords(preview.next);
    if (records.dual) announce(preview);
  }
  // La previsualización de activación depende de la carrera de origen: de
  // ella sale qué plan es simulado y, por tanto, qué no debe retirarse.
  function activationPreview(origin: string, chosen: Record<string, Mark>) {
    return previewDualActivation({ ...records, originProgram: origin }, programModels, verifiedShared, chosen);
  }
  // Reelegir un estado reconstruye la previsualización desde los registros
  // originales: las elecciones nunca se acumulan sobre un preview anterior.
  function resolve(next: Record<string, Mark>) {
    setResolutions(next);
    setPending(current => current?.kind === "activation"
      ? { ...current, preview: activationPreview(originChoice ?? program.id, next) }
      : current);
  }
  function chooseOrigin(origin: string) {
    setOriginChoice(origin);
    setPending(current => current?.kind === "activation"
      ? { ...current, preview: activationPreview(origin, resolutions) }
      : current);
  }
  function academicMarkPreview(id: VersionCourseId, mark: Mark) {
    const course = program.versionCoursesById.get(id);
    if (!course) throw new Error("Unknown course in active plan");
    return previewAcademicMark(records, programModels, verifiedShared, program.id, course.courseId, mark);
  }
  function activeResult(preview: AcademicPreview, id: VersionCourseId, mark: Mark): TrajectoryReconciliation {
    const result = preview.reconciliations.find(entry => entry.programId === program.id)!.result;
    return { ...result, requested: { versionCourseId: id, mark } };
  }
  function previewMarkCourse(id: VersionCourseId, mark: Mark) {
    return activeResult(academicMarkPreview(id, mark), id, mark);
  }
  function markCourse(id: VersionCourseId, mark: Mark) {
    const preview = academicMarkPreview(id, mark);
    apply(preview);
    return activeResult(preview, id, mark);
  }
  function toggleDual() {
    if (!ready || pending) return;
    if (records.dual) { setPending({ kind: "deactivation" }); return; }
    // La carrera de origen se pregunta una sola vez; si ya se eligió antes, se
    // conserva y no se vuelve a plantear al reactivar.
    const origin = records.originProgram ?? program.id;
    setOriginChoice(origin);
    const detected = activationPreview(origin, {});
    // Cada conflicto real se propone como «Completada», pero sigue siendo una
    // elección visible y editable: la previsualización se recalcula con ella.
    const proposed = Object.fromEntries(detected.conflicts.map(conflict => [conflict.courseId, "COMPLETED" as Mark]));
    setResolutions(proposed);
    setPending({
      kind: "activation",
      conflicts: detected.conflicts,
      preview: detected.conflicts.length ? activationPreview(origin, proposed) : detected,
    });
  }
  return <TrajectoryContext.Provider value={{ trajectory, states, evaluationContext, program, records, ready, markCourse, previewMarkCourse, toggleDual,
    skipSharedConfirmation: preferences.skipSharedConfirmation,
    setSkipSharedConfirmation: changePreferences,
    /* Siempre sobre el plan activo: un registro manual pertenece al programa
       en el que se creó y la Doble Titulación no lo copia ni lo sincroniza. */
    freeChoiceEntries: freeChoiceEntriesOf(records, program.snapshot.planVersion.id),
    saveFreeChoiceEntry: entry => {
      if (!ready || pending) return;
      setRecords(current => withFreeChoiceEntry(current, program.snapshot.planVersion.id, entry));
    },
    removeFreeChoiceEntry: id => {
      if (!ready || pending) return;
      setRecords(current => withoutFreeChoiceEntry(current, program.snapshot.planVersion.id, id));
    },
    // Cambiar de carrera de origen no reescribe marcas: decide qué plan manda
    // en las reconciliaciones siguientes y dónde se rotula la simulación.
    setOriginProgram: id => { if (ready && !pending && records.dual && programs.some(entry => entry.id === id)) setRecords(current => ({ ...current, originProgram: id })); },
    setProgram: id => { if (ready && !pending && programs.some(program => program.id === id)) setRecords(current => ({ ...current, activeProgram: id })); },
    markExternal: (id, completed) => apply(previewAcademicMark(records, programModels, verifiedShared, program.id, id, completed ? "COMPLETED" : "UNMARKED")),
  }}>
    {storageError ? <p role="status">No se puede guardar el seguimiento local. Tus datos anteriores se conservaron; los cambios de esta sesión podrían no persistir.</p> : null}
    {children}
    {/* Siempre presente para que el lector de pantalla tenga la región ya
        observada cuando llegue el texto; vacía no pinta nada. */}
    <div aria-live="polite" aria-atomic="true">
      {notice ? <p key={notice.id} className={noticeStyles.notice}>{notice.text}</p> : null}
    </div>
    {pending?.kind === "deactivation" ? <DualDeactivationDialog programId={program.id} onCancel={cancel}
      onConfirm={() => { setRecords(deactivateDual(records)); cancel(); }} /> : null}
    {pending && pending.kind !== "deactivation" ? <AcademicChangeDialog programId={program.id} preview={pending.preview} activation={pending.kind === "activation"} conflicts={pending.conflicts} resolutions={resolutions}
      onResolve={(id, mark) => resolve({ ...resolutions, [id]: mark })}
      onResolveAll={mark => resolve(Object.fromEntries(pending.conflicts.map(conflict => [conflict.courseId, mark])))}
      /* La casilla solo tiene sentido con los planes vinculados y para los
         cambios de marca: la activación se confirma una sola vez. */
      remember={pending.kind === "mark" && records.dual ? remember : undefined}
      onRememberChange={setRemember}
      origin={pending.kind === "activation" && records.originProgram === undefined ? originChoice ?? program.id : undefined}
      originProgram={pending.kind === "activation" ? originChoice ?? program.id : records.dual ? records.originProgram : undefined}
      onOriginChange={chooseOrigin}
      onCancel={cancel} onConfirm={() => {
        if (pending.preview.conflicts.length > 0) return;
        setRecords(pending.kind === "activation"
          ? { ...pending.preview.next, originProgram: originChoice ?? program.id }
          : pending.preview.next);
        if (pending.kind === "mark" && records.dual && remember) changePreferences(true);
        cancel();
      }} /> : null}
  </TrajectoryContext.Provider>;
}
export function useTrajectory(): TrajectoryContextValue {
  const context = useContext(TrajectoryContext);
  if (!context) throw new Error("useTrajectory must be used within TrajectoryProvider");
  return context;
}
