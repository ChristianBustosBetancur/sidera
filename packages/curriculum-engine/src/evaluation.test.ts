import { describe, expect, it } from "vitest";
import type {
  ComponentId,
  CourseId,
  GroupingId,
  PlanVersionId,
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@curriculum-universe/curriculum-domain";
import {
  collectBlockingEvaluations,
  deriveVersionCourseState,
  evaluateRequirementExpression,
  evaluateVersionCourseEligibility,
} from "./index.js";
import type { CurriculumEvaluationContext, StudentTrajectory } from "./types.js";

const planVersionId = "plan-version-fictitious" as PlanVersionId;
const otherPlanVersionId = "other-plan-version-fictitious" as PlanVersionId;
const componentAId = "component-a" as ComponentId;
const componentBId = "component-b" as ComponentId;
const groupingAId = "grouping-a" as GroupingId;
const groupingBId = "grouping-b" as GroupingId;
const targetId = "target-course" as VersionCourseId;
const completedAId = "completed-a" as VersionCourseId;
const completedASecondId = "completed-a-second" as VersionCourseId;
const inProgressAId = "in-progress-a" as VersionCourseId;
const completedBId = "completed-b" as VersionCourseId;

function versionCourse(
  id: VersionCourseId,
  groupingId: GroupingId,
  credits: number,
  requirements?: RequirementExpression,
  versionId = planVersionId,
): VersionCourse {
  return {
    id,
    planVersionId: versionId,
    courseId: `course-${id}` as CourseId,
    groupingId,
    academicCode: `FIC-${id}`,
    credits,
    requirements,
  };
}

function createContext(
  targetRequirements?: RequirementExpression,
): CurriculumEvaluationContext {
  return {
    planVersionId,
    components: [
      { id: componentAId, planVersionId, name: "Componente A ficticio" },
      { id: componentBId, planVersionId, name: "Componente B ficticio" },
    ],
    groupings: [
      { id: groupingAId, componentId: componentAId, name: "Agrupación A ficticia" },
      { id: groupingBId, componentId: componentBId, name: "Agrupación B ficticia" },
    ],
    versionCourses: [
      versionCourse(targetId, groupingAId, 3, targetRequirements),
      versionCourse(completedAId, groupingAId, 4),
      versionCourse(completedASecondId, groupingAId, 2),
      versionCourse(inProgressAId, groupingAId, 5),
      versionCourse(completedBId, groupingBId, 6),
      versionCourse(
        "other-version-course" as VersionCourseId,
        groupingAId,
        100,
        undefined,
        otherPlanVersionId,
      ),
    ],
  };
}

function trajectory(
  completedVersionCourseIds: readonly VersionCourseId[] = [],
  inProgressVersionCourseIds: readonly VersionCourseId[] = [],
): StudentTrajectory {
  return { completedVersionCourseIds, inProgressVersionCourseIds };
}

describe("course requirements", () => {
  it("marks a course without requirements as available", () => {
    expect(deriveVersionCourseState(targetId, createContext(), trajectory())).toMatchObject({
      state: "AVAILABLE",
      eligibility: { satisfied: true },
    });
  });

  it("requires COURSE_COMPLETED to be completed, not merely in progress", () => {
    const expression = {
      type: "COURSE_COMPLETED",
      versionCourseId: completedAId,
    } satisfies RequirementExpression;

    expect(
      evaluateRequirementExpression(
        expression,
        createContext(),
        trajectory([completedAId]),
      ).satisfied,
    ).toBe(true);
    expect(
      evaluateRequirementExpression(
        expression,
        createContext(),
        trajectory([], [completedAId]),
      ).satisfied,
    ).toBe(false);
  });

  it("accepts completed or in-progress courses for COURSE_COMPLETED_OR_CONCURRENT", () => {
    const expression = {
      type: "COURSE_COMPLETED_OR_CONCURRENT",
      versionCourseId: completedAId,
    } satisfies RequirementExpression;
    const context = createContext();

    expect(
      evaluateRequirementExpression(expression, context, trajectory([completedAId])).satisfied,
    ).toBe(true);
    expect(
      evaluateRequirementExpression(expression, context, trajectory([], [completedAId]))
        .satisfied,
    ).toBe(true);
    expect(evaluateRequirementExpression(expression, context, trajectory()).satisfied).toBe(
      false,
    );
  });
});

describe("composite requirements", () => {
  const completedChild = {
    type: "COURSE_COMPLETED" as const,
    versionCourseId: completedAId,
  };
  const missingChild = {
    type: "COURSE_COMPLETED" as const,
    versionCourseId: completedASecondId,
  };

  it("preserves the failing child in an ALL evaluation tree", () => {
    const result = evaluateRequirementExpression(
      { type: "ALL", children: [completedChild, missingChild] },
      createContext(),
      trajectory([completedAId]),
    );

    expect(result.satisfied).toBe(false);
    expect("children" in result && result.children.map((child) => child.satisfied)).toEqual([
      true,
      false,
    ]);
    expect(collectBlockingEvaluations(result)).toMatchObject([
      { type: "COURSE_COMPLETED", versionCourseId: completedASecondId },
    ]);
  });

  it("does not flatten unfulfilled alternatives from a satisfied ANY", () => {
    const result = evaluateRequirementExpression(
      { type: "ANY", children: [completedChild, missingChild] },
      createContext(),
      trajectory([completedAId]),
    );

    expect(result.satisfied).toBe(true);
    expect(collectBlockingEvaluations(result)).toEqual([]);
  });

  it("counts direct satisfied children for AT_LEAST and diagnoses an excessive threshold", () => {
    const children: RequirementExpression[] = [
      completedChild,
      missingChild,
      { type: "COURSE_COMPLETED", versionCourseId: completedBId },
    ];
    const context = createContext();
    const student = trajectory([completedAId, completedBId]);

    expect(
      evaluateRequirementExpression(
        { type: "AT_LEAST", threshold: 2, children },
        context,
        student,
      ).satisfied,
    ).toBe(true);
    expect(
      evaluateRequirementExpression(
        { type: "AT_LEAST", threshold: 3, children },
        context,
        student,
      ).satisfied,
    ).toBe(false);

    const excessive = evaluateRequirementExpression(
      { type: "AT_LEAST", threshold: 4, children },
      context,
      student,
    );
    expect(excessive.satisfied).toBe(false);
    expect(excessive.diagnostics).toContainEqual({
      code: "INVALID_THRESHOLD",
      threshold: 4,
      childCount: 3,
    });
  });

  it("handles empty expressions with deterministic structural diagnostics", () => {
    const context = createContext();
    const student = trajectory();
    const all = evaluateRequirementExpression({ type: "ALL", children: [] }, context, student);
    const any = evaluateRequirementExpression({ type: "ANY", children: [] }, context, student);
    const atLeast = evaluateRequirementExpression(
      { type: "AT_LEAST", threshold: 1, children: [] },
      context,
      student,
    );

    expect(all.satisfied).toBe(true);
    expect(any.satisfied).toBe(false);
    expect(atLeast.satisfied).toBe(false);
    expect(all.diagnostics[0]).toEqual({ code: "EMPTY_EXPRESSION", nodeType: "ALL" });
    expect(any.diagnostics[0]).toEqual({ code: "EMPTY_EXPRESSION", nodeType: "ANY" });
    expect(atLeast.diagnostics[0]).toEqual({
      code: "EMPTY_EXPRESSION",
      nodeType: "AT_LEAST",
    });
  });
});

describe("credit and grouping requirements", () => {
  it("counts only completed courses from the current plan version for total credits", () => {
    const result = evaluateRequirementExpression(
      { type: "MIN_TOTAL_CREDITS", credits: 5 },
      createContext(),
      trajectory(
        [completedAId, "other-version-course" as VersionCourseId],
        [inProgressAId],
      ),
    );

    expect(result).toMatchObject({ satisfied: false, required: 5, actual: 4 });
  });

  it("counts component credits through each course grouping", () => {
    const result = evaluateRequirementExpression(
      { type: "MIN_COMPONENT_CREDITS", componentId: componentAId, credits: 5 },
      createContext(),
      trajectory([completedAId, completedBId]),
    );

    expect(result).toMatchObject({ satisfied: false, required: 5, actual: 4 });
  });

  it("counts grouping credits and courses while excluding the evaluated course itself", () => {
    const context = createContext();
    const student = trajectory([targetId, completedAId], [inProgressAId]);
    const credits = evaluateRequirementExpression(
      { type: "MIN_GROUPING_CREDITS", groupingId: groupingAId, credits: 5 },
      context,
      student,
      targetId,
    );
    const courses = evaluateRequirementExpression(
      { type: "MIN_GROUPING_COURSES", groupingId: groupingAId, courseCount: 2 },
      context,
      student,
      targetId,
    );

    expect(credits).toMatchObject({ satisfied: false, required: 5, actual: 4 });
    expect(courses).toMatchObject({ satisfied: false, required: 2, actual: 1 });
  });
});

describe("diagnostics and state", () => {
  it("returns unresolved-reference diagnostics for all supported reference kinds", () => {
    const context = createContext();
    const student = trajectory();
    const missingCourseId = "missing-course" as VersionCourseId;
    const missingComponentId = "missing-component" as ComponentId;
    const missingGroupingId = "missing-grouping" as GroupingId;

    expect(
      evaluateRequirementExpression(
        { type: "COURSE_COMPLETED", versionCourseId: missingCourseId },
        context,
        student,
      ).diagnostics,
    ).toContainEqual({
      code: "UNRESOLVED_REFERENCE",
      referenceType: "VERSION_COURSE",
      referenceId: missingCourseId,
    });
    expect(
      evaluateRequirementExpression(
        { type: "MIN_COMPONENT_CREDITS", componentId: missingComponentId, credits: 1 },
        context,
        student,
      ).diagnostics,
    ).toContainEqual({
      code: "UNRESOLVED_REFERENCE",
      referenceType: "COMPONENT",
      referenceId: missingComponentId,
    });
    expect(
      evaluateRequirementExpression(
        { type: "MIN_GROUPING_COURSES", groupingId: missingGroupingId, courseCount: 1 },
        context,
        student,
      ).diagnostics,
    ).toContainEqual({
      code: "UNRESOLVED_REFERENCE",
      referenceType: "GROUPING",
      referenceId: missingGroupingId,
    });
  });

  it("derives all four states with completed taking precedence", () => {
    const blockingRequirement = {
      type: "COURSE_COMPLETED",
      versionCourseId: completedAId,
    } satisfies RequirementExpression;

    expect(
      deriveVersionCourseState(
        targetId,
        createContext(),
        trajectory([targetId], [targetId]),
      ),
    ).toEqual({ state: "COMPLETED" });
    expect(
      deriveVersionCourseState(targetId, createContext(), trajectory([], [targetId])),
    ).toEqual({ state: "IN_PROGRESS" });
    expect(deriveVersionCourseState(targetId, createContext(), trajectory()).state).toBe(
      "AVAILABLE",
    );

    const blocked = deriveVersionCourseState(
      targetId,
      createContext(blockingRequirement),
      trajectory(),
    );
    expect(blocked.state).toBe("BLOCKED");
    expect("eligibility" in blocked && blocked.eligibility.requirementEvaluation).toMatchObject({
      type: "COURSE_COMPLETED",
      satisfied: false,
    });
  });

  it("returns a blocked diagnostic instead of throwing for an unknown target course", () => {
    const missingId = "missing-target" as VersionCourseId;
    const result = deriveVersionCourseState(missingId, createContext(), trajectory());

    expect(result.state).toBe("BLOCKED");
    expect("eligibility" in result && result.eligibility.diagnostics).toContainEqual({
      code: "UNRESOLVED_REFERENCE",
      referenceType: "VERSION_COURSE",
      referenceId: missingId,
    });
  });

  it("produces identical trees and diagnostic order for identical input", () => {
    const expression: RequirementExpression = {
      type: "ALL",
      children: [
        { type: "COURSE_COMPLETED", versionCourseId: completedAId },
        {
          type: "AT_LEAST",
          threshold: 3,
          children: [
            { type: "COURSE_COMPLETED", versionCourseId: completedASecondId },
            { type: "COURSE_COMPLETED", versionCourseId: completedBId },
          ],
        },
      ],
    };
    const context = createContext();
    const student = trajectory([completedAId]);

    expect(evaluateRequirementExpression(expression, context, student)).toEqual(
      evaluateRequirementExpression(expression, context, student),
    );
    expect(evaluateVersionCourseEligibility(targetId, context, student)).toEqual(
      evaluateVersionCourseEligibility(targetId, context, student),
    );
  });
});
