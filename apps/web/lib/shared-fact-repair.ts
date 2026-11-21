import type { AcademicRecords, ProgramModel } from "@sidera/curriculum-engine";

/* Reparación de los planes simulados que una versión anterior vació.

   Hasta el arreglo de la reconciliación, activar la Doble Titulación podía
   retirar de «En curso» un hecho compartido en el programa simulado: la marca
   del plan quedaba en UNMARKED mientras `sharedFacts` conservaba el estado
   real. Ese desajuste es reparable sin pérdida porque el dato bueno nunca se
   perdió.

   La reparación es deliberadamente tímida: solo rellena huecos. Una marca
   explícita del estudiante —Completada o En curso— se respeta siempre, nunca
   se toca `sharedFacts` ni el plan de la carrera de origen, y el resultado es
   idempotente: pasarla dos veces no cambia nada la segunda vez. */

export const SHARED_REPAIR_KEY = "sidera:shared-fact-repair:v1";

export type SharedFactRepair = {
  records: AcademicRecords;
  restored: { programId: string; count: number }[];
};

export function repairSharedFacts(records: AcademicRecords, models: readonly ProgramModel[]): SharedFactRepair {
  // Sin planes vinculados no hay simulación que reparar, y sin carrera de
  // origen no se sabe qué plan es el real.
  if (!records.dual || records.originProgram === undefined) return { records, restored: [] };

  let repaired = records;
  const restored: { programId: string; count: number }[] = [];

  for (const model of models) {
    if (model.id === records.originProgram) continue;
    const plan = records.plans[model.context.planVersionId] ?? { marks: {}, externalCompleted: {} };
    const marks = { ...plan.marks };
    let count = 0;

    for (const [courseId, fact] of Object.entries(records.sharedFacts)) {
      // «Sin marcar» como hecho compartido no restaura nada: no hay estado.
      if (fact === "UNMARKED") continue;
      const course = model.context.versionCourses.find(course => course.courseId === courseId);
      if (course === undefined) continue;
      const current = marks[course.id];
      // Hueco = sin registro o retirada. Cualquier otra cosa es del estudiante.
      if (current !== undefined && current !== "UNMARKED") continue;
      marks[course.id] = fact;
      count += 1;
    }

    if (count === 0) continue;
    repaired = {
      ...repaired,
      plans: { ...repaired.plans, [model.context.planVersionId]: { ...plan, marks } },
    };
    restored.push({ programId: model.id, count });
  }

  return { records: repaired, restored };
}

/* El indicador vive en su propia clave: es un apunte de mantenimiento, no
   parte del expediente. Si el almacenamiento falla, se prefiere no repetir la
   reparación antes que arriesgarse a repetir el aviso en cada carga. */
export function sharedRepairDone(): boolean {
  try {
    return localStorage.getItem(SHARED_REPAIR_KEY) !== null;
  } catch {
    return true;
  }
}

export function markSharedRepairDone(): void {
  try {
    localStorage.setItem(SHARED_REPAIR_KEY, new Date().toISOString());
  } catch {
    // Sin persistencia la reparación simplemente se reintentará; es idempotente.
  }
}

export function repairNoticeText(
  restored: readonly { programId: string; count: number }[],
  label: (programId: string) => string,
): string | undefined {
  if (restored.length === 0) return undefined;
  return restored
    .map(entry => entry.count === 1
      ? `Se restauró 1 asignatura compartida en ${label(entry.programId)}.`
      : `Se restauraron ${entry.count} asignaturas compartidas en ${label(entry.programId)}.`)
    .join(" ");
}
