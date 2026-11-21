"use client";

import type { CourseId } from "@sidera/curriculum-domain";
import { programs, academicCourseName } from "./programs";
import { useTrajectory } from "./trajectory";
import styles from "./program-selector.module.css";

export function ProgramSelector() {
  const { program, records, ready, setProgram, toggleDual, markExternal } = useTrajectory();
  const external = program.snapshot.externalCourses ?? [];
  return <div className={styles.controls}>
    <label className={styles.selector}>Programa académico
      <select value={program.id} disabled={!ready} onChange={event => setProgram(event.target.value)}>
        {programs.map(program => <option key={program.id} value={program.id}>{program.label}</option>)}
      </select>
    </label>
    <details className={styles.settings}>
      <summary>{records.dual ? "Doble Titulación · vinculada" : "Seguimiento académico"}</summary>
      <div className={styles.panel}>
        <h2>Doble Titulación</h2>
        <p>Lleva un seguimiento conjunto de las asignaturas compartidas entre tus programas. Es seguimiento personal, no una homologación oficial.</p>
        <button type="button" disabled={!ready} onClick={toggleDual}>{records.dual ? "Desactivar Doble Titulación" : "Activar Doble Titulación"}</button>
        <p>Al desactivar, ambos programas conservan las últimas marcas reflejadas y continúan por separado.</p>
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
    </details>
  </div>;
}
