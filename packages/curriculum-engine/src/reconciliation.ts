import type { VersionCourseId } from "@sidera/curriculum-domain";
import {
  collectBlockingEvaluations,
  createEvaluationIndexes,
  type EvaluationIndexes,
  evaluateEligibilityWithIndexes,
} from "./evaluation.js";
import type {
  CurriculumEvaluationContext,
  StudentTrajectory,
  TrajectoryChange,
  TrajectoryInvalidation,
  TrajectoryReconciliation,
  TrajectoryWarning,
} from "./types.js";

function applyChange(
  trajectory: StudentTrajectory,
  change: TrajectoryChange,
): StudentTrajectory {
  const completed = trajectory.completedVersionCourseIds.filter(
    (id) => id !== change.versionCourseId,
  );
  const inProgress = trajectory.inProgressVersionCourseIds.filter(
    (id) => id !== change.versionCourseId,
  );
  return {
    completedVersionCourseIds:
      change.mark === "COMPLETED"
        ? [...completed, change.versionCourseId]
        : completed,
    inProgressVersionCourseIds:
      change.mark === "IN_PROGRESS"
        ? [...inProgress, change.versionCourseId]
        : inProgress,
  };
}

/* Reconcilia la trayectoria tras un cambio del estudiante.
 *
 * Dos políticas distintas, deliberadamente:
 *
 * IN_PROGRESS describe el presente. Un presente académicamente imposible se
 * corrige: la materia se retira y la retirada puede arrastrar a otras.
 *
 * COMPLETED describe el historial. NO se retira nunca de forma automática,
 * porque la trayectoria es un conjunto sin orden temporal: no puede saberse si
 * el estudiante cursó la materia antes de perder ese requisito o si solo está
 * corrigiendo su historial retrospectivamente. Se reporta como advertencia y la
 * decisión queda en sus manos.
 *
 * El recorrido es un punto fijo por rondas sobre las materias EN CURSO, no una
 * propagación por aristas. Es una decisión consciente: las aristas del grafo no
 * representan los requisitos agregados —créditos totales, por componente, por
 * agrupación y número de materias de una agrupación—, así que propagar por
 * ellas omitiría en silencio toda invalidación causada por un umbral de
 * créditos. Reevaluar cada materia marcada con el evaluador real cubre además
 * ANY, AT_LEAST y los correquisitos sin reimplementar su semántica.
 *
 * Termina siempre: cada ronda solo RETIRA marcas, nunca las añade, y el
 * conjunto de marcas es finito. Por la misma razón el resultado no depende del
 * orden de recorrido: retirar una marca solo puede hacer que otros requisitos
 * dejen de cumplirse, nunca lo contrario, de modo que el punto fijo es único.
 */
export function reconcileTrajectory(
  change: TrajectoryChange,
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): TrajectoryReconciliation {
  let current = applyChange(trajectory, change);

  /* Los mapas del plan no cambian durante la reconciliación: se construyen una
     vez y cada ronda solo rehace los dos conjuntos de la trayectoria. */
  const planIndexes = createEvaluationIndexes(context, current);
  const buildIndexes = (next: StudentTrajectory): EvaluationIndexes =>
    createEvaluationIndexes(context, next, planIndexes);

  const invalidations: TrajectoryInvalidation[] = [];
  let depth = 1;

  for (;;) {
    const indexes = buildIndexes(current);
    const retired: VersionCourseId[] = [];

    /* Se reevalúa la ronda completa contra la MISMA foto de la trayectoria, y
       las retiradas se aplican al final. Así ninguna materia de la ronda ve un
       estado intermedio y el resultado no depende del orden de la lista. */
    for (const versionCourseId of current.inProgressVersionCourseIds) {
      const eligibility = evaluateEligibilityWithIndexes(
        versionCourseId,
        context,
        indexes,
      );
      if (eligibility.satisfied) continue;

      retired.push(versionCourseId);
      invalidations.push({
        versionCourseId,
        previousMark: "IN_PROGRESS",
        nextMark: "UNMARKED",
        depth,
        blocking: eligibility.requirementEvaluation
          ? collectBlockingEvaluations(eligibility.requirementEvaluation)
          : [],
      });
    }

    if (retired.length === 0) break;

    const retiredIds = new Set(retired);
    current = {
      completedVersionCourseIds: current.completedVersionCourseIds,
      inProgressVersionCourseIds: current.inProgressVersionCourseIds.filter(
        (id) => !retiredIds.has(id),
      ),
    };
    depth += 1;
  }

  /* Las advertencias se calculan una sola vez, ya alcanzado el punto fijo:
     antes reflejarían un estado intermedio que el estudiante nunca llega a
     ver. */
  const finalIndexes = buildIndexes(current);
  const warnings: TrajectoryWarning[] = [];
  for (const versionCourseId of current.completedVersionCourseIds) {
    const eligibility = evaluateEligibilityWithIndexes(
      versionCourseId,
      context,
      finalIndexes,
    );
    if (eligibility.satisfied) continue;
    warnings.push({
      versionCourseId,
      mark: "COMPLETED",
      blocking: eligibility.requirementEvaluation
        ? collectBlockingEvaluations(eligibility.requirementEvaluation)
        : [],
    });
  }

  return { requested: change, nextTrajectory: current, invalidations, warnings };
}
