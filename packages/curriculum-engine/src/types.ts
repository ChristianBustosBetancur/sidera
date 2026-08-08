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
