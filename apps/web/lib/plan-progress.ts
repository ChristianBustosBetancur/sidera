import { calculateFreeChoiceProgress, calculateSatisfiedPlanProgress, type CurriculumEvaluationContext, type FreeChoiceEntry, type StudentTrajectory } from "@sidera/curriculum-engine";
import type { AcademicProgramData } from "./programs";

/** La instantánea curricular tal como la expone el registro de programas. */
type Snapshot = AcademicProgramData["snapshot"];

/* Progreso del plan incluyendo la estimación de Libre Elección.

   Los 140 y 146 créditos exigidos ya cuentan ese componente, pero hasta ahora
   nada podía aportarle: no tiene materias modeladas. Los créditos optativos
   que otra agrupación no reconoce son excedente —no están en
   `satisfiedCredits`, por definición— así que sumarlos aquí no duplica nada.

   Es una sola fuente para la cabecera y para la barra de contexto: si cada
   vista lo calculara por su cuenta volverían a discrepar. */

export function freeChoiceRequiredCredits(snapshot: Snapshot): number {
  const modelled = new Set(snapshot.groupings.map(grouping => grouping.componentId));
  return snapshot.components
    .filter(component => !modelled.has(component.id))
    .reduce((total, component) => total + component.requiredCredits, 0);
}

export function planProgressWithFreeChoice(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  snapshot: Snapshot,
  /** Asignaturas que el estudiante declaró en Libre Elección para este plan. */
  entries: readonly FreeChoiceEntry[] = [],
) {
  const progress = calculateSatisfiedPlanProgress(context, trajectory, snapshot.planVersion.requiredCredits);
  const freeChoice = calculateFreeChoiceProgress(context, trajectory, freeChoiceRequiredCredits(snapshot), entries);
  const satisfiedCredits = progress.satisfiedCredits + freeChoice.estimatedCredits;
  return {
    progress,
    freeChoice,
    satisfiedCredits,
    projectedSatisfiedCredits: progress.projectedSatisfiedCredits + freeChoice.projectedCredits,
    requiredCredits: progress.requiredCredits,
  };
}
