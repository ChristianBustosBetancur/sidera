"use client";

import type { AcademicPreview, SharedConflict, TrajectoryMark } from "@sidera/curriculum-engine";
import { academicCourseName, programs } from "./programs";
import { ModalShell } from "./dialog-shell";
import { requirementShortfall } from "./sync-notice";
import styles from "./trajectory-change-dialog.module.css";

export const markLabels: Record<TrajectoryMark, string> = { COMPLETED: "Completada", IN_PROGRESS: "En curso", UNMARKED: "Sin marcar" };
const titleId = "academic-preview-title";
const summaryId = "academic-preview-summary";

function plural(count: number, singular: string, many: string) {
  return `${count} ${count === 1 ? singular : many}`;
}

export function AcademicChangeDialog({ preview, activation, programId, conflicts, resolutions, remember, origin, originProgram, onResolve, onResolveAll, onRememberChange, onOriginChange, onConfirm, onCancel }: {
  preview: AcademicPreview;
  programId: string;
  activation: boolean;
  conflicts: SharedConflict[];
  resolutions: Record<string, TrajectoryMark>;
  /** `undefined` oculta la casilla: no toda confirmación es repetible. */
  remember?: boolean;
  /** `undefined` cuando la carrera de origen ya está elegida: se pregunta una vez. */
  origin?: string;
  /** Carrera real en vigor: el resto de programas se rotulan como simulados. */
  originProgram?: string;
  onResolve: (id: string, mark: TrajectoryMark) => void;
  onResolveAll: (mark: TrajectoryMark) => void;
  onRememberChange: (remember: boolean) => void;
  onOriginChange: (programId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const name = (id: string) => programs.find(program => program.id === id)?.label ?? id;
  const retires = preview.reconciliations.some(entry => entry.result.invalidations.length > 0);
  // Agrupar por estado mantiene la lista compacta: el estudiante lee «qué se
  // comparte y cómo», no una fila por asignatura y programa.
  const byMark = preview.shared.reduce<Partial<Record<TrajectoryMark, string[]>>>((groups, adoption) => {
    (groups[adoption.mark] ??= []).push(academicCourseName(adoption.courseId));
    return groups;
  }, {});
  const summary = activation
    ? conflicts.length
      ? `${plural(conflicts.length, "asignatura tiene", "asignaturas tienen")} estados distintos en cada programa: elige cuál conservar. En total se compartirán ${plural(preview.shared.length, "asignatura", "asignaturas")}.`
      : preview.shared.length
        ? `${plural(preview.shared.length, "asignatura se compartirá", "asignaturas se compartirán")} entre tus programas.`
        : "No hay marcas nuevas que compartir. El seguimiento quedará vinculado para los próximos cambios."
    : "Revisa los cambios antes de confirmar. Cada programa calcula sus requisitos y créditos por separado.";

  return <ModalShell programId={programId} labelledBy={titleId} describedBy={summaryId} onCancel={onCancel}>
    <h2 id={titleId}>{activation ? "Activar Doble Titulación" : "Previsualizar cambio académico"}</h2>
    <p id={summaryId}>{summary}</p>
    {activation ? <p className={styles.groupNote}>Cada programa sigue calculando sus requisitos y créditos por separado. Es seguimiento personal, no una homologación oficial.</p> : null}

    {/* Se pregunta una sola vez y aquí mismo: de ella depende qué plan es real
        y cuál se simula, y por tanto dónde se avisa en lugar de retirar. */}
    {origin === undefined ? null : <section className={styles.group}>
      <h3>¿Cuál es tu carrera de origen?</h3>
      <p className={styles.groupNote}>El otro programa se mostrará como simulado. No cambia créditos ni requisitos: solo evita que un plan simulado retire asignaturas que estás cursando de verdad.</p>
      <label className={styles.conflict}>
        <select aria-label="Carrera de origen" value={origin} onChange={event => onOriginChange(event.target.value)}>
          {programs.map(program => <option key={program.id} value={program.id}>{program.label}</option>)}
        </select>
      </label>
    </section>}

    {conflicts.length ? <section className={styles.group}>
      <h3>Estados diferentes: elige cuál conservar<span className={styles.count}>{plural(conflicts.length, "asignatura", "asignaturas")}</span></h3>
      <p className={styles.groupNote}>Se propone «Completada»; puedes cambiar cualquiera antes de confirmar.</p>
      {conflicts.length > 1 ? <label className={styles.conflict}>
        <strong>Aplicar a todas</strong>
        <select aria-label="Aplicar un mismo estado a todas las asignaturas en conflicto" value="" onChange={event => { if (event.target.value) onResolveAll(event.target.value as TrajectoryMark); }}>
          <option value="" disabled>Elige un estado para todas</option>
          {Object.entries(markLabels).map(([mark, label]) => <option key={mark} value={mark}>{label}</option>)}
        </select>
      </label> : null}
      {conflicts.map(conflict => <label key={conflict.courseId} className={styles.conflict}>
        <strong>{academicCourseName(conflict.courseId)}</strong>
        {conflict.states.map(state => <span key={state.programId}>{name(state.programId)}: {markLabels[state.mark]}</span>)}
        <select aria-label={`Estado compartido de ${academicCourseName(conflict.courseId)}`} value={resolutions[conflict.courseId] ?? ""} onChange={event => onResolve(conflict.courseId, event.target.value as TrajectoryMark)}>
          <option value="" disabled>Selecciona un estado</option>
          {Object.entries(markLabels).map(([mark, label]) => <option key={mark} value={mark}>{label}</option>)}
        </select>
      </label>)}
    </section> : null}

    {activation ? Object.entries(byMark).map(([mark, names]) => <section className={styles.group} key={mark}>
      <h3>Se compartirá como «{markLabels[mark as TrajectoryMark]}»<span className={styles.count}>{plural(names.length, "asignatura", "asignaturas")}</span></h3>
      <ul className={styles.impacts}>
        {names.map(courseName => <li key={courseName}><strong>{courseName}</strong></li>)}
      </ul>
    </section>) : null}

    {programs.map(program => {
      const changes = activation ? [] : preview.changes.filter(change => change.programId === program.id);
      const reconciliation = preview.reconciliations.find(result => result.programId === program.id)?.result;
      // En un plan simulado, un hecho compartido no se retira: se conserva y
      // se advierte. Esos avisos llegan como warnings «En curso».
      const simulated = originProgram !== undefined && program.id !== originProgram;
      const preservedWarnings = simulated
        ? (reconciliation?.warnings ?? []).filter(warning => warning.mark === "IN_PROGRESS")
        : [];
      if (!changes.length && !reconciliation?.invalidations.length && !preservedWarnings.length) return null;
      return <section className={styles.group} key={program.id}>
        <h3>{simulated ? `${program.label} (simulado)` : program.label}</h3>
        <ul className={styles.impacts}>
          {changes.map(change => <li key={change.courseId}><strong>{academicCourseName(change.courseId)}</strong><span>{change.before ? markLabels[change.before] : "Sin registro"} → {markLabels[change.after]}</span></li>)}
          {reconciliation?.invalidations.map(item => <li key={`retire-${item.versionCourseId}`}><strong>{program.courseReference(item.versionCourseId)}</strong><span>Se retirará de «En curso»: {program.blockingReasonsFromNodes(item.blocking).join(". ")}</span></li>)}
          {preservedWarnings.map(item => <li key={`kept-${item.versionCourseId}`}><strong>{program.courseReference(item.versionCourseId)}</strong>
            <span>Se mantiene «En curso»{(() => { const detail = requirementShortfall(program.blockingReasonsFromNodes(item.blocking)); return detail ? ` · ${detail}` : ""; })()}</span>
          </li>)}
        </ul>
      </section>;
    })}

    <p className={styles.groupNote}>Las aprobadas se conservan.{retires ? " Una retirada de «En curso» en un plan no borra el registro académico compartido." : ""} Puedes cancelar sin modificar tus trayectorias.</p>
    {remember === undefined ? null : <label className={styles.remember}>
      <input type="checkbox" checked={remember} onChange={event => onRememberChange(event.target.checked)} />
      No volver a mostrar esta confirmación mientras la Doble Titulación esté activa
    </label>}
    <div className={styles.actions}>
      <button className={styles.cancel} onClick={onCancel}>Cancelar</button>
      <button className={styles.confirm} disabled={preview.conflicts.length > 0} onClick={onConfirm}>Confirmar cambios</button>
    </div>
  </ModalShell>;
}
