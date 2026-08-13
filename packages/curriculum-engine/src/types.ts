import type {
  Component,
  ComponentId,
  Grouping,
  GroupingId,
  PlanVersionId,
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";

export type StudentTrajectory = {
  completedVersionCourseIds: readonly VersionCourseId[];
  inProgressVersionCourseIds: readonly VersionCourseId[];
};

export type CurriculumEvaluationContext = {
  planVersionId: PlanVersionId;
  versionCourses: readonly VersionCourse[];
  groupings: readonly Grouping[];
  components: readonly Component[];
};

export type UnresolvedReferenceDiagnostic = {
  code: "UNRESOLVED_REFERENCE";
  referenceType: "VERSION_COURSE" | "COMPONENT" | "GROUPING";
  referenceId: VersionCourseId | ComponentId | GroupingId;
};

export type PlanProgressResult = {
  completedCredits: number;
  requiredCredits: number;
  ratio: number;
  diagnostics: readonly UnresolvedReferenceDiagnostic[];
};

export type CreditProgress = {
  rawCredits: number;
  satisfiedCredits: number;
  excessCredits: number;
  projectedSatisfiedCredits: number;
};

export type GroupingCreditProgress = CreditProgress & {
  groupingId: GroupingId;
  requiredCredits: number;
};

export type ComponentCreditProgress = CreditProgress & {
  componentId: ComponentId;
  requiredCredits: number;
  groupings: readonly GroupingCreditProgress[];
};

export type HierarchicalRequiredCreditsDiagnostic = {
  code: "INCONSISTENT_HIERARCHICAL_REQUIRED_CREDITS";
  scope: "COMPONENT" | "PLAN";
  scopeId: ComponentId | PlanVersionId;
  requiredCredits: number;
  childrenRequiredCredits: number;
};

export type NegativeElectiveCapacityDiagnostic = {
  code: "NEGATIVE_ELECTIVE_CREDIT_CAPACITY";
  groupingId: GroupingId;
  requiredCredits: number;
  mandatoryCredits: number;
};

export type SatisfiedCreditProgressDiagnostic =
  | UnresolvedReferenceDiagnostic
  | HierarchicalRequiredCreditsDiagnostic
  | NegativeElectiveCapacityDiagnostic;

export type SatisfiedPlanProgressResult = CreditProgress & {
  planVersionId: PlanVersionId;
  requiredCredits: number;
  components: readonly ComponentCreditProgress[];
  diagnostics: readonly SatisfiedCreditProgressDiagnostic[];
};

export type InvalidThresholdDiagnostic = {
  code: "INVALID_THRESHOLD";
  threshold: number;
  childCount: number;
};

export type EmptyExpressionDiagnostic = {
  code: "EMPTY_EXPRESSION";
  nodeType: "ALL" | "ANY" | "AT_LEAST";
};

export type EvaluationDiagnostic =
  | UnresolvedReferenceDiagnostic
  | InvalidThresholdDiagnostic
  | EmptyExpressionDiagnostic;

type EvaluationNodeBase<Type extends RequirementExpression["type"]> = {
  type: Type;
  satisfied: boolean;
  diagnostics: readonly EvaluationDiagnostic[];
};

export type CourseRequirementEvaluation = EvaluationNodeBase<
  "COURSE_COMPLETED" | "COURSE_COMPLETED_OR_CONCURRENT"
> & {
  versionCourseId: VersionCourseId;
};

export type CreditRequirementEvaluation = EvaluationNodeBase<
  | "MIN_TOTAL_CREDITS"
  | "MIN_COMPONENT_CREDITS"
  | "MIN_GROUPING_CREDITS"
> & {
  required: number;
  actual: number;
  componentId?: ComponentId;
  groupingId?: GroupingId;
};

export type GroupingCoursesRequirementEvaluation =
  EvaluationNodeBase<"MIN_GROUPING_COURSES"> & {
    groupingId: GroupingId;
    required: number;
    actual: number;
  };

export type CompositeRequirementEvaluation = EvaluationNodeBase<
  "ALL" | "ANY" | "AT_LEAST"
> & {
  children: readonly RequirementEvaluationNode[];
  threshold?: number;
  satisfiedChildCount?: number;
};

export type RequirementEvaluationNode =
  | CourseRequirementEvaluation
  | CreditRequirementEvaluation
  | GroupingCoursesRequirementEvaluation
  | CompositeRequirementEvaluation;

export type VersionCourseEligibilityEvaluation = {
  versionCourseId: VersionCourseId;
  satisfied: boolean;
  requirementEvaluation?: RequirementEvaluationNode;
  diagnostics: readonly EvaluationDiagnostic[];
};

export type DerivedCourseState = "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "BLOCKED";

export type DerivedCourseStateResult =
  | { state: "COMPLETED" }
  | { state: "IN_PROGRESS" }
  | {
      state: "AVAILABLE" | "BLOCKED";
      eligibility: VersionCourseEligibilityEvaluation;
    };

/* ── Reconciliación de trayectoria ─────────────────────────────────────────
   Editar la trayectoria puede dejar otras materias marcadas sin sustento
   académico. La reconciliación distingue dos situaciones que NO deben
   confundirse, porque una se corrige sola y la otra es una decisión del
   estudiante. */

export type TrajectoryMark = "COMPLETED" | "IN_PROGRESS" | "UNMARKED";

export type TrajectoryChange = {
  versionCourseId: VersionCourseId;
  mark: TrajectoryMark;
};

/* Materia que estaba EN CURSO y deja de cumplir sus requisitos: se retira
   automáticamente. "En curso" describe el presente del estudiante, así que un
   presente imposible se corrige.
   `depth` es la distancia en rondas desde el cambio solicitado: 1 es efecto
   directo, 2 o más es cascada. Permite ordenar y agrupar el aviso sin
   recalcular nada. */
export type TrajectoryInvalidation = {
  versionCourseId: VersionCourseId;
  previousMark: "IN_PROGRESS";
  nextMark: "UNMARKED";
  depth: number;
  blocking: readonly RequirementEvaluationNode[];
};

/* Materia APROBADA que, con la foto actual de la trayectoria, ya no sería
   elegible. NO se retira: la trayectoria no guarda orden temporal, así que no
   se puede saber si el estudiante la cursó antes de perder ese requisito o si
   simplemente está corrigiendo su historial. Se reporta para que decida. */
export type TrajectoryWarning = {
  versionCourseId: VersionCourseId;
  mark: "COMPLETED";
  blocking: readonly RequirementEvaluationNode[];
};

export type TrajectoryReconciliation = {
  requested: TrajectoryChange;
  nextTrajectory: StudentTrajectory;
  invalidations: readonly TrajectoryInvalidation[];
  warnings: readonly TrajectoryWarning[];
};
