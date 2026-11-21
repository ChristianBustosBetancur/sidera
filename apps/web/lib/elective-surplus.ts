import type { GroupingId, VersionCourse, VersionCourseId } from "@sidera/curriculum-domain";
import { groupingSurpluses, type CurriculumEvaluationContext, type StudentTrajectory } from "@sidera/curriculum-engine";

/* Presentación del cupo optativo de una agrupación.

   Deliberadamente habla de CRÉDITOS y nunca señala una asignatura como «la
   que sobra». Cuando dos optativas aprobadas de 4 créditos compiten por un
   cupo de 4, lo único que consta es que sobran 4 créditos: cuál de las dos
   «pertenece» a Libre Elección no se puede saber sin el periodo de aprobación,
   que Sidera no registra. El motor sigue repartiendo con su orden interno
   —necesario para que las cifras sean deterministas— pero ese orden no se
   convierte en una afirmación sobre una materia concreta.

   Con créditos fraccionados la diferencia importa todavía más: en Computación
   hay agrupaciones con cupo 7 y optativas de 4, donde una asignatura aporta 3
   créditos a la agrupación y 1 al excedente. Decir que «pasó a Libre Elección»
   sería falso. */

export type GroupingElectiveState = {
  groupingId: GroupingId;
  capacity: number;
  approvedSurplus: number;
  inProgressSurplus: number;
  /** Optativas aprobadas de la agrupación. */
  approvedElectives: number;
  /** Optativas en curso de la agrupación. */
  inProgressElectives: number;
  /** El cupo optativo está cubierto: marcar más optativas no mueve la barra. */
  electivesFull: boolean;
  missingMandatory: VersionCourseId[];
};

export function groupingElectiveStates(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): Map<GroupingId, GroupingElectiveState> {
  const completed = new Set(trajectory.completedVersionCourseIds);
  const inProgress = new Set(trajectory.inProgressVersionCourseIds);
  const byCode = (a: VersionCourse, b: VersionCourse) => a.academicCode.localeCompare(b.academicCode);

  return new Map(groupingSurpluses(context, trajectory).map(surplus => {
    const courses = context.versionCourses.filter(course => course.groupingId === surplus.groupingId);
    const electives = courses.filter(course => !course.mandatory);
    const markedCredits = electives
      .filter(course => completed.has(course.id) || inProgress.has(course.id))
      .reduce((total, course) => total + course.credits, 0);

    return [surplus.groupingId, {
      groupingId: surplus.groupingId,
      capacity: surplus.capacity,
      approvedSurplus: surplus.approvedSurplus,
      inProgressSurplus: surplus.inProgressSurplus,
      approvedElectives: electives.filter(course => completed.has(course.id)).length,
      inProgressElectives: electives.filter(course => inProgress.has(course.id)).length,
      electivesFull: surplus.capacity > 0 && markedCredits >= surplus.capacity,
      missingMandatory: courses
        .filter(course => course.mandatory && !completed.has(course.id))
        .sort(byCode)
        .map(course => course.id),
    }] as const;
  }));
}

const surplusCredits = (amount: number) =>
  `${amount} ${amount === 1 ? "crédito excedente" : "créditos excedentes"}`;

/** «+4 créditos excedentes · +4 en curso», agregados y sin nombrar materias. */
export function surplusNote(state: GroupingElectiveState): string | undefined {
  const parts: string[] = [];
  if (state.approvedSurplus > 0) parts.push(`+${surplusCredits(state.approvedSurplus)}`);
  if (state.inProgressSurplus > 0) parts.push(`+${surplusCredits(state.inProgressSurplus)} en curso`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/* «Optativas completas · falta 3006886 Análisis numérico»: sin esta línea, una
   agrupación con el cupo lleno parece congelada al marcar más optativas. */
export function electivesFullNote(
  state: GroupingElectiveState,
  reference: (versionCourseId: VersionCourseId) => string,
): string | undefined {
  if (!state.electivesFull || state.missingMandatory.length === 0) return undefined;
  const [first, second, ...rest] = state.missingMandatory;
  const names = [first, second].filter((id): id is VersionCourseId => id !== undefined).map(reference);
  const tail = rest.length > 0 ? ` y ${rest.length} más` : "";
  return `Optativas completas · ${names.length === 1 ? "falta" : "faltan"} ${names.join(", ")}${tail}`;
}

/** Origen de los créditos que alimentan Libre Elección, por agrupación. */
export type FreeChoiceOrigin = {
  groupingId: GroupingId;
  approvedSurplus: number;
  inProgressSurplus: number;
  approvedElectives: number;
  inProgressElectives: number;
};

export function freeChoiceOrigins(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): FreeChoiceOrigin[] {
  return [...groupingElectiveStates(context, trajectory).values()]
    .filter(state => state.approvedSurplus > 0 || state.inProgressSurplus > 0)
    .map(({ groupingId, approvedSurplus, inProgressSurplus, approvedElectives, inProgressElectives }) =>
      ({ groupingId, approvedSurplus, inProgressSurplus, approvedElectives, inProgressElectives }));
}

/** «4 créditos excedentes · 2 optativas aprobadas en la agrupación» */
export function originNote(origin: FreeChoiceOrigin): string {
  const parts: string[] = [];
  if (origin.approvedSurplus > 0) {
    parts.push(`${surplusCredits(origin.approvedSurplus)} de ${origin.approvedElectives} ${origin.approvedElectives === 1 ? "optativa aprobada" : "optativas aprobadas"}`);
  }
  if (origin.inProgressSurplus > 0) {
    const amount = origin.inProgressSurplus;
    parts.push(`${amount} ${amount === 1 ? "crédito proyectado" : "créditos proyectados"} de ${origin.inProgressElectives} ${origin.inProgressElectives === 1 ? "optativa en curso" : "optativas en curso"}`);
  }
  return parts.join(" · ");
}
