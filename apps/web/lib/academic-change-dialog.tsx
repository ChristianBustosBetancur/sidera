"use client";

import type { AcademicPreview, SharedConflict, TrajectoryMark } from "@sidera/curriculum-engine";
import { useEffect, useRef } from "react";
import { academicCourseName, programs } from "./programs";
import styles from "./trajectory-change-dialog.module.css";

export const markLabels: Record<TrajectoryMark, string> = { COMPLETED: "Completada", IN_PROGRESS: "En curso", UNMARKED: "Sin marcar" };

export function AcademicChangeDialog({ preview, activation, programId, conflicts, resolutions, onResolve, onConfirm, onCancel }: {
  preview: AcademicPreview;
  programId: string;
  activation: boolean;
  conflicts: SharedConflict[];
  resolutions: Record<string, TrajectoryMark>;
  onResolve: (id: string, mark: TrajectoryMark) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
      if (event.key !== "Tab") return;
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select');
      const first = elements?.[0];
      const last = elements?.[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onCancel]);
  const name = (id: string) => programs.find(program => program.id === id)?.label ?? id;
  return <div data-program={programId}>
    <div className={styles.overlay} onClick={onCancel} aria-hidden="true" />
    <div ref={ref} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="academic-preview-title">
      <h2 id="academic-preview-title">{activation ? "Activar Doble Titulación" : "Previsualizar cambio académico"}</h2>
      <p>Revisa los cambios antes de confirmar. Cada programa calcula sus requisitos y créditos por separado.</p>
      {conflicts.length ? <section className={styles.group}>
        <h3>Estados diferentes: elige cuál conservar</h3>
        {conflicts.map(conflict => <label key={conflict.courseId} className={styles.conflict}>
          <strong>{academicCourseName(conflict.courseId)}</strong>
          {conflict.states.map(state => <span key={state.programId}>{name(state.programId)}: {markLabels[state.mark]}</span>)}
          <select aria-label={`Estado compartido de ${academicCourseName(conflict.courseId)}`} value={resolutions[conflict.courseId] ?? ""} onChange={event => onResolve(conflict.courseId, event.target.value as TrajectoryMark)}>
            <option value="" disabled>Selecciona un estado</option>
            {Object.entries(markLabels).map(([mark, label]) => <option key={mark} value={mark}>{label}</option>)}
          </select>
        </label>)}
      </section> : null}
      {programs.map(program => {
        const changes = preview.changes.filter(change => change.programId === program.id);
        const reconciliation = preview.reconciliations.find(result => result.programId === program.id)?.result;
        if (!changes.length && !reconciliation?.invalidations.length) return null;
        return <section className={styles.group} key={program.id}>
          <h3>{program.label}</h3>
          <ul className={styles.impacts}>
            {changes.map(change => <li key={change.courseId}><strong>{academicCourseName(change.courseId)}</strong><span>{change.before ? markLabels[change.before] : "Sin registro"} → {markLabels[change.after]}</span></li>)}
            {reconciliation?.invalidations.map(item => <li key={`retire-${item.versionCourseId}`}><strong>{program.courseReference(item.versionCourseId)}</strong><span>Se retirará de «En curso»: {program.blockingReasonsFromNodes(item.blocking).join(". ")}</span></li>)}
          </ul>
        </section>;
      })}
      {!preview.changes.length && !preview.conflicts.length ? <p>No hay marcas nuevas que compartir. El seguimiento quedará vinculado para los próximos cambios.</p> : null}
      <p className={styles.groupNote}>Las aprobadas se conservan. Una retirada de «En curso» en un plan no borra el registro académico compartido. Puedes cancelar sin modificar tus trayectorias.</p>
      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onCancel}>Cancelar</button>
        <button className={styles.confirm} disabled={preview.conflicts.length > 0} onClick={onConfirm}>Confirmar cambios</button>
      </div>
    </div>
  </div>;
}
