"use client";

import type { CourseId, VersionCourseId } from "@sidera/curriculum-domain";
import { deriveVersionCourseState, programRecord, recordTrajectory, recordContext, previewAcademicMark, previewDualActivation, deactivateDual, reconcileTrajectory, type AcademicRecords, type AcademicPreview, type SharedConflict, type CurriculumEvaluationContext, type DerivedCourseState, type StudentTrajectory, type TrajectoryReconciliation } from "@sidera/curriculum-engine";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { programs, programModels, verifiedShared, type AcademicProgramData } from "./programs";
import { emptyAcademicRecords, loadAcademicRecords, saveAcademicRecords } from "./academic-storage";
import { AcademicChangeDialog } from "./academic-change-dialog";
import { DualDeactivationDialog } from "./dual-deactivation-dialog";

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
  useEffect(() => {
    const loaded = loadAcademicRecords();
    setRecords(loaded.records);
    setWritable(loaded.writable);
    setStorageError(!loaded.writable);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && writable) setStorageError(!saveAcademicRecords(records));
  }, [records, ready, writable]);
  const program = programs.find(program => program.id === records.activeProgram) ?? programs[0]!;
  const record = programRecord(records, { id: program.id, context: program.evaluationContext });
  const trajectory = useMemo(() => recordTrajectory(record, program.evaluationContext), [record, program]);
  const evaluationContext = useMemo(() => recordContext(record, program.evaluationContext), [record, program]);
  const states = useMemo(() => new Map(program.snapshot.versionCourses.map(course => [course.id, deriveVersionCourseState(course.id, evaluationContext, trajectory).state])), [program, evaluationContext, trajectory]);
  const cancel = useCallback(() => { setPending(null); setResolutions({}); }, []);
  function apply(preview: AcademicPreview) {
    if (!ready || pending) return;
    if (preview.requiresConfirmation) setPending({ kind: "mark", preview, conflicts: [] });
    else setRecords(preview.next);
  }
  // Reelegir un estado reconstruye la previsualización desde los registros
  // originales: las elecciones nunca se acumulan sobre un preview anterior.
  function resolve(next: Record<string, Mark>) {
    setResolutions(next);
    setPending(current => current?.kind === "activation"
      ? { ...current, preview: previewDualActivation(records, programModels, verifiedShared, next) }
      : current);
  }
  function previewMarkCourse(id: VersionCourseId, mark: Mark) {
    return reconcileTrajectory({ versionCourseId: id, mark }, evaluationContext, trajectory);
  }
  function markCourse(id: VersionCourseId, mark: Mark) {
    const course = program.versionCoursesById.get(id);
    if (!course) throw new Error("Unknown course in active plan");
    const result = previewMarkCourse(id, mark);
    apply(previewAcademicMark(records, programModels, verifiedShared, program.id, course.courseId, mark));
    return result;
  }
  function toggleDual() {
    if (!ready || pending) return;
    if (records.dual) { setPending({ kind: "deactivation" }); return; }
    const detected = previewDualActivation(records, programModels, verifiedShared);
    // Cada conflicto real se propone como «Completada», pero sigue siendo una
    // elección visible y editable: la previsualización se recalcula con ella.
    const proposed = Object.fromEntries(detected.conflicts.map(conflict => [conflict.courseId, "COMPLETED" as Mark]));
    setResolutions(proposed);
    setPending({
      kind: "activation",
      conflicts: detected.conflicts,
      preview: detected.conflicts.length ? previewDualActivation(records, programModels, verifiedShared, proposed) : detected,
    });
  }
  return <TrajectoryContext.Provider value={{ trajectory, states, evaluationContext, program, records, ready, markCourse, previewMarkCourse, toggleDual,
    setProgram: id => { if (ready && !pending && programs.some(program => program.id === id)) setRecords(current => ({ ...current, activeProgram: id })); },
    markExternal: (id, completed) => apply(previewAcademicMark(records, programModels, verifiedShared, program.id, id, completed ? "COMPLETED" : "UNMARKED")),
  }}>
    {storageError ? <p role="status">No se puede guardar el seguimiento local. Tus datos anteriores se conservaron; los cambios de esta sesión podrían no persistir.</p> : null}
    {children}
    {pending?.kind === "deactivation" ? <DualDeactivationDialog programId={program.id} onCancel={cancel}
      onConfirm={() => { setRecords(deactivateDual(records)); cancel(); }} /> : null}
    {pending && pending.kind !== "deactivation" ? <AcademicChangeDialog programId={program.id} preview={pending.preview} activation={pending.kind === "activation"} conflicts={pending.conflicts} resolutions={resolutions}
      onResolve={(id, mark) => resolve({ ...resolutions, [id]: mark })}
      onResolveAll={mark => resolve(Object.fromEntries(pending.conflicts.map(conflict => [conflict.courseId, mark])))}
      onCancel={cancel} onConfirm={() => { if (pending.preview.conflicts.length === 0) { setRecords(pending.preview.next); cancel(); } }} /> : null}
  </TrajectoryContext.Provider>;
}
export function useTrajectory(): TrajectoryContextValue {
  const context = useContext(TrajectoryContext);
  if (!context) throw new Error("useTrajectory must be used within TrajectoryProvider");
  return context;
}
