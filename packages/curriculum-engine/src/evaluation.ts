import type {
  Component,
  ComponentId,
  Grouping,
  GroupingId,
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@curriculum-universe/curriculum-domain";
import type {
  CompositeRequirementEvaluation,
  CurriculumEvaluationContext,
  EvaluationDiagnostic,
  RequirementEvaluationNode,
  StudentTrajectory,
  VersionCourseEligibilityEvaluation,
} from "./types.js";

type EvaluationIndexes = {
  versionCourses: ReadonlyMap<VersionCourseId, VersionCourse>;
  components: ReadonlyMap<ComponentId, Component>;
  groupings: ReadonlyMap<GroupingId, Grouping>;
  completedVersionCourseIds: ReadonlySet<VersionCourseId>;
  inProgressVersionCourseIds: ReadonlySet<VersionCourseId>;
};

type EvaluationEnvironment = {
  context: CurriculumEvaluationContext;
  indexes: EvaluationIndexes;
  evaluatedVersionCourseId?: VersionCourseId;
};

function createIndexes(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): EvaluationIndexes {
  const components = new Map<ComponentId, Component>();
  for (const component of context.components) {
    if (component.planVersionId === context.planVersionId) {
      components.set(component.id, component);
    }
  }

  const groupings = new Map<GroupingId, Grouping>();
  for (const grouping of context.groupings) {
    groupings.set(grouping.id, grouping);
  }

  const versionCourses = new Map<VersionCourseId, VersionCourse>();
  for (const versionCourse of context.versionCourses) {
    if (versionCourse.planVersionId === context.planVersionId) {
      versionCourses.set(versionCourse.id, versionCourse);
    }
  }

  return {
    versionCourses,
    components,
    groupings,
    completedVersionCourseIds: new Set(trajectory.completedVersionCourseIds),
    inProgressVersionCourseIds: new Set(trajectory.inProgressVersionCourseIds),
  };
}

function unresolvedReference(
  referenceType: "VERSION_COURSE" | "COMPONENT" | "GROUPING",
  referenceId: VersionCourseId | ComponentId | GroupingId,
): EvaluationDiagnostic {
  return {
    code: "UNRESOLVED_REFERENCE",
    referenceType,
    referenceId,
  };
}

function isCompleted(
  versionCourseId: VersionCourseId,
  environment: EvaluationEnvironment,
): boolean {
  return (
    versionCourseId !== environment.evaluatedVersionCourseId &&
    environment.indexes.completedVersionCourseIds.has(versionCourseId)
  );
}

function completedCourses(environment: EvaluationEnvironment): readonly VersionCourse[] {
  return environment.context.versionCourses.filter(
    (versionCourse) =>
      versionCourse.planVersionId === environment.context.planVersionId &&
      environment.indexes.versionCourses.has(versionCourse.id) &&
      isCompleted(versionCourse.id, environment),
  );
}

function evaluateCourseRequirement(
  expression: Extract<
    RequirementExpression,
    { type: "COURSE_COMPLETED" | "COURSE_COMPLETED_OR_CONCURRENT" }
  >,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  if (!environment.indexes.versionCourses.has(expression.versionCourseId)) {
    return {
      type: expression.type,
      versionCourseId: expression.versionCourseId,
      satisfied: false,
      diagnostics: [unresolvedReference("VERSION_COURSE", expression.versionCourseId)],
    };
  }

  const completed = isCompleted(expression.versionCourseId, environment);
  const inProgress = environment.indexes.inProgressVersionCourseIds.has(
    expression.versionCourseId,
  );

  return {
    type: expression.type,
    versionCourseId: expression.versionCourseId,
    satisfied:
      expression.type === "COURSE_COMPLETED" ? completed : completed || inProgress,
    diagnostics: [],
  };
}

function evaluateMinimumTotalCredits(
  expression: Extract<RequirementExpression, { type: "MIN_TOTAL_CREDITS" }>,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  const actual = completedCourses(environment).reduce(
    (credits, versionCourse) => credits + versionCourse.credits,
    0,
  );

  return {
    type: expression.type,
    required: expression.credits,
    actual,
    satisfied: actual >= expression.credits,
    diagnostics: [],
  };
}

function evaluateMinimumComponentCredits(
  expression: Extract<RequirementExpression, { type: "MIN_COMPONENT_CREDITS" }>,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  if (!environment.indexes.components.has(expression.componentId)) {
    return {
      type: expression.type,
      componentId: expression.componentId,
      required: expression.credits,
      actual: 0,
      satisfied: false,
      diagnostics: [unresolvedReference("COMPONENT", expression.componentId)],
    };
  }

  const actual = completedCourses(environment).reduce((credits, versionCourse) => {
    const grouping = environment.indexes.groupings.get(versionCourse.groupingId);
    return grouping?.componentId === expression.componentId
      ? credits + versionCourse.credits
      : credits;
  }, 0);

  return {
    type: expression.type,
    componentId: expression.componentId,
    required: expression.credits,
    actual,
    satisfied: actual >= expression.credits,
    diagnostics: [],
  };
}

function evaluateMinimumGroupingCredits(
  expression: Extract<RequirementExpression, { type: "MIN_GROUPING_CREDITS" }>,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  if (!environment.indexes.groupings.has(expression.groupingId)) {
    return {
      type: expression.type,
      groupingId: expression.groupingId,
      required: expression.credits,
      actual: 0,
      satisfied: false,
      diagnostics: [unresolvedReference("GROUPING", expression.groupingId)],
    };
  }

  const actual = completedCourses(environment).reduce(
    (credits, versionCourse) =>
      versionCourse.groupingId === expression.groupingId
        ? credits + versionCourse.credits
        : credits,
    0,
  );

  return {
    type: expression.type,
    groupingId: expression.groupingId,
    required: expression.credits,
    actual,
    satisfied: actual >= expression.credits,
    diagnostics: [],
  };
}

function evaluateMinimumGroupingCourses(
  expression: Extract<RequirementExpression, { type: "MIN_GROUPING_COURSES" }>,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  if (!environment.indexes.groupings.has(expression.groupingId)) {
    return {
      type: expression.type,
      groupingId: expression.groupingId,
      required: expression.courseCount,
      actual: 0,
      satisfied: false,
      diagnostics: [unresolvedReference("GROUPING", expression.groupingId)],
    };
  }

  const actual = completedCourses(environment).filter(
    (versionCourse) => versionCourse.groupingId === expression.groupingId,
  ).length;

  return {
    type: expression.type,
    groupingId: expression.groupingId,
    required: expression.courseCount,
    actual,
    satisfied: actual >= expression.courseCount,
    diagnostics: [],
  };
}

function evaluateComposite(
  expression: Extract<RequirementExpression, { type: "ALL" | "ANY" | "AT_LEAST" }>,
  environment: EvaluationEnvironment,
): CompositeRequirementEvaluation {
  const children = expression.children.map((child) => evaluateNode(child, environment));
  const diagnostics: EvaluationDiagnostic[] = [];

  if (children.length === 0) {
    diagnostics.push({ code: "EMPTY_EXPRESSION", nodeType: expression.type });
  }

  if (expression.type === "ALL") {
    return {
      type: expression.type,
      satisfied: children.every((child) => child.satisfied),
      children,
      diagnostics,
    };
  }

  if (expression.type === "ANY") {
    return {
      type: expression.type,
      satisfied: children.some((child) => child.satisfied),
      children,
      diagnostics,
    };
  }

  const satisfiedChildCount = children.filter((child) => child.satisfied).length;
  if (expression.threshold > children.length) {
    diagnostics.push({
      code: "INVALID_THRESHOLD",
      threshold: expression.threshold,
      childCount: children.length,
    });
  }

  return {
    type: expression.type,
    threshold: expression.threshold,
    satisfiedChildCount,
    satisfied:
      children.length > 0 &&
      expression.threshold <= children.length &&
      satisfiedChildCount >= expression.threshold,
    children,
    diagnostics,
  };
}

function evaluateNode(
  expression: RequirementExpression,
  environment: EvaluationEnvironment,
): RequirementEvaluationNode {
  switch (expression.type) {
    case "COURSE_COMPLETED":
    case "COURSE_COMPLETED_OR_CONCURRENT":
      return evaluateCourseRequirement(expression, environment);
    case "MIN_TOTAL_CREDITS":
      return evaluateMinimumTotalCredits(expression, environment);
    case "MIN_COMPONENT_CREDITS":
      return evaluateMinimumComponentCredits(expression, environment);
    case "MIN_GROUPING_CREDITS":
      return evaluateMinimumGroupingCredits(expression, environment);
    case "MIN_GROUPING_COURSES":
      return evaluateMinimumGroupingCourses(expression, environment);
    case "ALL":
    case "ANY":
    case "AT_LEAST":
      return evaluateComposite(expression, environment);
  }
}

export function evaluateRequirementExpression(
  expression: RequirementExpression,
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  evaluatedVersionCourseId?: VersionCourseId,
): RequirementEvaluationNode {
  return evaluateNode(expression, {
    context,
    indexes: createIndexes(context, trajectory),
    evaluatedVersionCourseId,
  });
}

export function collectEvaluationDiagnostics(
  evaluation: RequirementEvaluationNode,
): readonly EvaluationDiagnostic[] {
  const diagnostics = [...evaluation.diagnostics];
  if ("children" in evaluation) {
    for (const child of evaluation.children) {
      diagnostics.push(...collectEvaluationDiagnostics(child));
    }
  }
  return diagnostics;
}

export function collectBlockingEvaluations(
  evaluation: RequirementEvaluationNode,
): readonly RequirementEvaluationNode[] {
  if (evaluation.satisfied) {
    return [];
  }
  if (!("children" in evaluation)) {
    return [evaluation];
  }
  if (evaluation.type === "ANY" || evaluation.type === "AT_LEAST") {
    return [evaluation];
  }
  return evaluation.children.flatMap((child) => collectBlockingEvaluations(child));
}

export function evaluateVersionCourseEligibility(
  versionCourseId: VersionCourseId,
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): VersionCourseEligibilityEvaluation {
  const indexes = createIndexes(context, trajectory);
  const versionCourse = indexes.versionCourses.get(versionCourseId);
  if (!versionCourse) {
    const diagnostic = unresolvedReference("VERSION_COURSE", versionCourseId);
    return {
      versionCourseId,
      satisfied: false,
      diagnostics: [diagnostic],
    };
  }

  if (!versionCourse.requirements) {
    return {
      versionCourseId,
      satisfied: true,
      diagnostics: [],
    };
  }

  const requirementEvaluation = evaluateNode(versionCourse.requirements, {
    context,
    indexes,
    evaluatedVersionCourseId: versionCourseId,
  });

  return {
    versionCourseId,
    satisfied: requirementEvaluation.satisfied,
    requirementEvaluation,
    diagnostics: collectEvaluationDiagnostics(requirementEvaluation),
  };
}
