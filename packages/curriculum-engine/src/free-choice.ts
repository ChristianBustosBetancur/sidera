import type { GroupingId, VersionCourseId } from "@sidera/curriculum-domain";
import type { CurriculumEvaluationContext, StudentTrajectory } from "./types.js";

/* Créditos optativos que una agrupación no puede reconocer, y su posible
   contribución al componente de Libre Elección.

   La aritmética es la misma que ya aplica `calculateSatisfiedPlanProgress`:
   una agrupación reconoce de lo optativo, como mucho, `requeridos − créditos
   de todas sus obligatorias`. Lo que sobra no desaparece del expediente, solo
   deja de contar en esa barra. Este módulo lo recoge.

   Se contabiliza en CRÉDITOS, no en asignaturas completas. Cuando una
   optativa queda a caballo del cupo —en Computación hay agrupaciones con cupo
   7 y optativas de 4— parte de sus créditos los reconoce la agrupación y
   parte sobra. Repartir por asignatura entera obligaría a contradecir alguna
   de las dos cifras; repartir por créditos conserva ambas y mantiene la
   identidad `bruto = reconocido + excedente`, de modo que ningún crédito se
   cuenta dos veces dentro del mismo plan.

   Nada de esto es un reconocimiento administrativo: es una estimación de
   Sidera sobre el mecanismo descrito por la Universidad, mientras no se
   verifique la norma aplicable. En Doble Titulación la distancia es mayor
   todavía: según el Acuerdo 155 de 2014 los créditos pendientes por componente
   y agrupación del segundo programa los determina su comité asesor, no este
   cálculo. Ver `docs/curriculum-sources/doble-titulacion-y-libre-eleccion.md`. */

export type GroupingSurplus = {
  groupingId: GroupingId;
  /** Créditos optativos que la agrupación puede reconocer. */
  capacity: number;
  /** Créditos optativos aprobados por encima del cupo. */
  approvedSurplus: number;
  /** Créditos optativos en curso que quedarían por encima del cupo. */
  inProgressSurplus: number;
  /** Asignaturas al final del reparto, origen del excedente. */
  contributors: SurplusContributor[];
};

export type SurplusContributor = {
  versionCourseId: VersionCourseId;
  groupingId: GroupingId;
  credits: number;
  mark: "COMPLETED" | "IN_PROGRESS";
  /** Créditos de esta asignatura que la agrupación no reconoce. */
  surplusCredits: number;
};

export type FreeChoiceProgress = {
  requiredCredits: number;
  /** Excedente aprobado reconocible en Libre Elección, topado al requisito. */
  estimatedCredits: number;
  /** Lo anterior más el excedente en curso, topado al requisito. */
  projectedCredits: number;
  /** Excedente que supera el cupo de Libre Elección y no se puede acreditar. */
  uncountedCredits: number;
  contributors: SurplusContributor[];
};

/* Convención de asignación de Sidera, no una regla del SIA: las Completadas
   consumen el cupo antes que las En curso —es lo que hace el motor al separar
   créditos reconocidos de proyectados— y, dentro de cada estado, se ordena
   por código académico. Así el excedente no depende de en qué orden se marcó
   cada asignatura y el resultado es reproducible. */
export function groupingSurpluses(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): GroupingSurplus[] {
  const completed = new Set(trajectory.completedVersionCourseIds);
  const inProgress = new Set(trajectory.inProgressVersionCourseIds);

  return context.groupings.map(grouping => {
    const courses = context.versionCourses.filter(course => course.groupingId === grouping.id);
    const mandatoryCredits = courses
      .filter(course => course.mandatory)
      .reduce((total, course) => total + course.credits, 0);
    const capacity = Math.max(grouping.requiredCredits - mandatoryCredits, 0);

    const byCode = (a: { academicCode: string }, b: { academicCode: string }) =>
      a.academicCode.localeCompare(b.academicCode);
    const electives = courses.filter(course => !course.mandatory);
    const marked = [
      ...electives.filter(course => completed.has(course.id)).sort(byCode),
      ...electives.filter(course => inProgress.has(course.id)).sort(byCode),
    ];

    const contributors: SurplusContributor[] = [];
    let consumed = 0;
    let approvedSurplus = 0;
    let inProgressSurplus = 0;
    for (const course of marked) {
      const recognised = Math.max(Math.min(capacity - consumed, course.credits), 0);
      consumed += recognised;
      const surplusCredits = course.credits - recognised;
      if (surplusCredits === 0) continue;
      const mark = completed.has(course.id) ? "COMPLETED" as const : "IN_PROGRESS" as const;
      if (mark === "COMPLETED") approvedSurplus += surplusCredits;
      else inProgressSurplus += surplusCredits;
      contributors.push({ versionCourseId: course.id, groupingId: grouping.id, credits: course.credits, mark, surplusCredits });
    }

    return { groupingId: grouping.id, capacity, approvedSurplus, inProgressSurplus, contributors };
  });
}

export function calculateFreeChoiceProgress(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  requiredCredits: number,
): FreeChoiceProgress {
  const surpluses = groupingSurpluses(context, trajectory);
  const approved = surpluses.reduce((total, entry) => total + entry.approvedSurplus, 0);
  const projectedRaw = approved + surpluses.reduce((total, entry) => total + entry.inProgressSurplus, 0);

  // El cupo del componente no se puede superar en la barra de cumplimiento,
  // pero el excedente restante tampoco se oculta: se informa aparte.
  const estimatedCredits = Math.min(approved, requiredCredits);
  const projectedCredits = Math.min(projectedRaw, requiredCredits);

  return {
    requiredCredits,
    estimatedCredits,
    projectedCredits,
    uncountedCredits: Math.max(projectedRaw - requiredCredits, 0),
    contributors: surpluses.flatMap(entry => entry.contributors),
  };
}
