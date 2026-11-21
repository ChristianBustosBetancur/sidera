export {
  collectBlockingEvaluations,
  collectEvaluationDiagnostics,
  createEvaluationIndexes,
  evaluateEligibilityWithIndexes,
  evaluateRequirementExpression,
  evaluateVersionCourseEligibility,
} from "./evaluation.js";
export type { EvaluationIndexes } from "./evaluation.js";
export { reconcileTrajectory } from "./reconciliation.js";
export { calculatePlanProgress, calculateSatisfiedPlanProgress } from "./progress.js";
export { deriveVersionCourseState } from "./state.js";
export type {
  CompositeRequirementEvaluation,
  ComponentCreditProgress,
  CreditProgress,
  CreditRequirementEvaluation,
  CurriculumEvaluationContext,
  DerivedCourseState,
  DerivedCourseStateResult,
  EmptyExpressionDiagnostic,
  EvaluationDiagnostic,
  GroupingCreditProgress,
  GroupingCoursesRequirementEvaluation,
  InvalidThresholdDiagnostic,
  HierarchicalRequiredCreditsDiagnostic,
  NegativeElectiveCapacityDiagnostic,
  PlanProgressResult,
  RequirementEvaluationNode,
  SatisfiedCreditProgressDiagnostic,
  SatisfiedPlanProgressResult,
  StudentTrajectory,
  TrajectoryChange,
  TrajectoryInvalidation,
  TrajectoryMark,
  TrajectoryReconciliation,
  TrajectoryWarning,
  UnresolvedReferenceDiagnostic,
  VersionCourseEligibilityEvaluation,
} from "./types.js";
export { programRecord, recordTrajectory, recordContext, previewAcademicMark, previewDualActivation, deactivateDual, type AcademicRecords, type AcademicPreview, type ProgramModel, type ProgramRecord, type SharedAdoption, type SharedConflict } from "./multi-program.js";
export { calculateFreeChoiceProgress, groupingSurpluses, type FreeChoiceEntry, type FreeChoiceProgress, type GroupingSurplus, type SurplusContributor } from "./free-choice.js";
