import type { CourseId } from "@sidera/curriculum-domain";
import type { AcademicRecords } from "@sidera/curriculum-engine";

/* Quién manda sobre una asignatura cuando hay dos planes en juego.

   La carrera de origen es la real; el resto son simulaciones. Un hecho
   compartido pertenece a la matrícula del estudiante, no al plan que lo
   muestra, así que ningún plan simulado puede retirarlo ni dejar su tarjeta
   sin acciones. */

export function isSimulatedProgram(records: AcademicRecords, programId: string): boolean {
  return records.dual && records.originProgram !== undefined && records.originProgram !== programId;
}

export function isSharedFact(records: AcademicRecords, courseId: CourseId): boolean {
  return records.dual && records.sharedFacts[courseId] !== undefined;
}

/** Un plan bloquea sus propias asignaturas, nunca un hecho compartido. */
export function marksAreAvailable(records: AcademicRecords, courseId: CourseId, blocked: boolean): boolean {
  return !blocked || isSharedFact(records, courseId);
}
