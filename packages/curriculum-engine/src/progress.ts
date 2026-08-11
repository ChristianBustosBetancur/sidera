import type { VersionCourseId } from "@sidera/curriculum-domain";
import type {
  ComponentCreditProgress,
  CurriculumEvaluationContext,
  GroupingCreditProgress,
  PlanProgressResult,
  SatisfiedCreditProgressDiagnostic,
  SatisfiedPlanProgressResult,
  StudentTrajectory,
  UnresolvedReferenceDiagnostic,
} from "./types.js";

export function calculateSatisfiedPlanProgress(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  requiredCredits: number,
): SatisfiedPlanProgressResult {
  const completedIds = new Set(trajectory.completedVersionCourseIds);
  const projectedIds = new Set([
    ...trajectory.completedVersionCourseIds,
    ...trajectory.inProgressVersionCourseIds,
  ]);
  const knownCourseIds = new Set(context.versionCourses.map((course) => course.id));
  const groupingById = new Map(context.groupings.map((grouping) => [grouping.id, grouping]));
  const componentIds = new Set(context.components.map((component) => component.id));
  const diagnostics: SatisfiedCreditProgressDiagnostic[] = [];

  for (const courseId of trajectory.completedVersionCourseIds) {
    if (!knownCourseIds.has(courseId)) {
      diagnostics.push({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: courseId,
      });
    }
  }
  for (const courseId of trajectory.inProgressVersionCourseIds) {
    if (!knownCourseIds.has(courseId)) {
      diagnostics.push({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: courseId,
      });
    }
  }
  for (const course of context.versionCourses) {
    if (!groupingById.has(course.groupingId)) {
      diagnostics.push({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "GROUPING",
        referenceId: course.groupingId,
      });
    }
  }
  for (const grouping of context.groupings) {
    if (!componentIds.has(grouping.componentId)) {
      diagnostics.push({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "COMPONENT",
        referenceId: grouping.componentId,
      });
    }
  }

  const groupingProgress = new Map(context.groupings.map((grouping) => {
    const courses = context.versionCourses.filter((course) => course.groupingId === grouping.id);
    const mandatoryCredits = sum(courses.filter((course) => course.mandatory), (course) => course.credits);
    const electiveCapacity = Math.max(grouping.requiredCredits - mandatoryCredits, 0);
    if (mandatoryCredits > grouping.requiredCredits) {
      diagnostics.push({
        code: "NEGATIVE_ELECTIVE_CREDIT_CAPACITY",
        groupingId: grouping.id,
        requiredCredits: grouping.requiredCredits,
        mandatoryCredits,
      });
    }

    const completed = courses.filter((course) => completedIds.has(course.id));
    const projected = courses.filter((course) => projectedIds.has(course.id));
    const rawCredits = sum(completed, (course) => course.credits);
    const mandatorySatisfied = sum(completed.filter((course) => course.mandatory), (course) => course.credits);
    const electiveSatisfied = Math.min(
      sum(completed.filter((course) => !course.mandatory), (course) => course.credits),
      electiveCapacity,
    );
    // Electives consume the residual capacity once; completed and in-progress
    // courses must not each receive an independent copy of that capacity.
    const projectedSatisfiedCredits =
      sum(projected.filter((course) => course.mandatory), (course) => course.credits) +
      Math.min(
        sum(projected.filter((course) => !course.mandatory), (course) => course.credits),
        electiveCapacity,
      );
    const satisfiedCredits = mandatorySatisfied + electiveSatisfied;
    const result: GroupingCreditProgress = {
      groupingId: grouping.id,
      requiredCredits: grouping.requiredCredits,
      rawCredits,
      satisfiedCredits,
      excessCredits: rawCredits - satisfiedCredits,
      projectedSatisfiedCredits,
    };
    return [grouping.id, result] as const;
  }));

  const components = context.components.map((component): ComponentCreditProgress => {
    const groupings = context.groupings
      .filter((grouping) => grouping.componentId === component.id)
      .map((grouping) => groupingProgress.get(grouping.id)!);
    const childrenRequiredCredits = sum(groupings, (grouping) => grouping.requiredCredits);
    if (childrenRequiredCredits > component.requiredCredits) {
      diagnostics.push({
        code: "INCONSISTENT_HIERARCHICAL_REQUIRED_CREDITS",
        scope: "COMPONENT",
        scopeId: component.id,
        requiredCredits: component.requiredCredits,
        childrenRequiredCredits,
      });
    }
    return aggregateProgress(groupings, {
      componentId: component.id,
      requiredCredits: component.requiredCredits,
      groupings,
    });
  });

  const childrenRequiredCredits = sum(components, (component) => component.requiredCredits);
  if (childrenRequiredCredits > requiredCredits) {
    diagnostics.push({
      code: "INCONSISTENT_HIERARCHICAL_REQUIRED_CREDITS",
      scope: "PLAN",
      scopeId: context.planVersionId,
      requiredCredits,
      childrenRequiredCredits,
    });
  }

  return aggregateProgress(components, {
    planVersionId: context.planVersionId,
    requiredCredits,
    components,
    diagnostics,
  });
}

function aggregateProgress<Child extends {
  rawCredits: number;
  satisfiedCredits: number;
  excessCredits: number;
  projectedSatisfiedCredits: number;
}, Extra extends object>(children: readonly Child[], extra: Extra): Extra & {
  rawCredits: number;
  satisfiedCredits: number;
  excessCredits: number;
  projectedSatisfiedCredits: number;
} {
  return {
    ...extra,
    rawCredits: sum(children, (child) => child.rawCredits),
    satisfiedCredits: sum(children, (child) => child.satisfiedCredits),
    excessCredits: sum(children, (child) => child.excessCredits),
    projectedSatisfiedCredits: sum(children, (child) => child.projectedSatisfiedCredits),
  };
}

function sum<T>(values: readonly T[], select: (value: T) => number): number {
  return values.reduce((total, value) => total + select(value), 0);
}

export function calculatePlanProgress(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  requiredCredits: number,
): PlanProgressResult {
  const completedVersionCourseIds = new Set(trajectory.completedVersionCourseIds);
  const contextVersionCourseIds = new Set<VersionCourseId>();
  let completedCredits = 0;

  for (const versionCourse of context.versionCourses) {
    contextVersionCourseIds.add(versionCourse.id);
    if (completedVersionCourseIds.has(versionCourse.id)) {
      completedCredits += versionCourse.credits;
    }
  }

  const diagnostics: UnresolvedReferenceDiagnostic[] =
    trajectory.completedVersionCourseIds
      .filter((versionCourseId) => !contextVersionCourseIds.has(versionCourseId))
      .map((versionCourseId) => ({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: versionCourseId,
      }));

  return {
    completedCredits,
    requiredCredits,
    ratio: Math.min(completedCredits / requiredCredits, 1),
    diagnostics,
  };
}
