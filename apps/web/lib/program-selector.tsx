"use client";

import type { CourseId } from "@sidera/curriculum-domain";
import { programs, academicCourseName } from "./programs";
import { useTrajectory } from "./trajectory";
import styles from "./program-selector.module.css";

const dualDescriptionId = "dual-degree-description";

export function ProgramSelector() {
  const { program, records, ready, setProgram, toggleDual, markExternal } = useTrajectory();
  const external = program.snapshot.externalCourses ?? [];
  const planNotes = external.length > 0 || program.id === "mathematics";
  return <div className={styles.controls}>
    <label className={styles.selector}>Programa académico
      <select value={program.id} disabled={!ready} onChange={event => setProgram(event.target.value)}>
        {programs.map(program => <option key={program.id} value={program.id}>{program.label}</option>)}
      </select>
    </label>

    {/* Un único control, sin panel intermedio: se presiona y el diálogo
        correspondiente confirma. El texto cambia con el estado para que la
        vinculación se reconozca de un vistazo, y `aria-checked` lo anuncia. */}
    <button type="button" role="switch" aria-checked={records.dual} aria-describedby={dualDescriptionId}
      title="Seguimiento conjunto de las asignaturas compartidas. Es seguimiento personal, no homologación oficial."
      className={styles.dualSwitch} disabled={!ready} onClick={toggleDual}>
      <span className={styles.dualMark} aria-hidden="true">{records.dual ? "✓" : ""}</span>
      {records.dual ? "Doble Titulación · Vinculada" : "Doble Titulación"}
    </button>
    <p id={dualDescriptionId} className={styles.dualDescription}>
      Seguimiento conjunto de las asignaturas compartidas. Es seguimiento personal, no homologación oficial.
    </p>

    {planNotes ? <details className={styles.settings}>
      <summary>Requisitos y notas del plan</summary>
      <div className={styles.panel}>
        {external.length ? <section>
          <h2>Requisitos externos</h2>
          <p>Registra su aprobación para evaluar requisitos. No añade créditos a los 140 del plan de Matemáticas.</p>
          {external.map(course => <label key={course.id} className={styles.external}>
            <input type="checkbox" disabled={!ready} checked={records.plans[program.snapshot.planVersion.id]?.externalCompleted[course.id] ?? false} onChange={event => markExternal(course.id as CourseId, event.target.checked)} />
            {academicCourseName(course.id)} · aprobada
          </label>)}
        </section> : null}
        {program.id === "mathematics" ? <p>Acuerdo 038 de 2020: versión transcrita del documento. La modalidad 3006947 «Cursos de posgrado» queda pendiente de verificación; no se suma como segunda obligación de Trabajo de Grado.</p> : null}
      </div>
    </details> : null}
  </div>;
}
