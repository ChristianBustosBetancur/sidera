import { describe, expect, it } from "vitest";
import type {
  Component,
  ComponentId,
  CourseId,
  Grouping,
  GroupingId,
  PlanVersionId,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import { calculatePlanProgress, calculateSatisfiedPlanProgress } from "./index.js";
import type { CurriculumEvaluationContext, StudentTrajectory } from "./types.js";

const planVersionId = "plan-version-progress" as PlanVersionId;
const groupingId = "grouping-progress" as GroupingId;
const courseAId = "course-a" as VersionCourseId;
const courseBId = "course-b" as VersionCourseId;
const courseCId = "course-c" as VersionCourseId;

function versionCourse(id: VersionCourseId, credits: number): VersionCourse {
  return {
    id,
    planVersionId,
    courseId: `catalog-${id}` as CourseId,
    groupingId,
    academicCode: `FIC-${id}`,
    credits,
    mandatory: true,
  };
}

function context(courses: readonly VersionCourse[]): CurriculumEvaluationContext {
  return {
    planVersionId,
    versionCourses: courses,
    groupings: [],
    components: [],
  };
}

function trajectory(
  completedVersionCourseIds: readonly VersionCourseId[] = [],
  inProgressVersionCourseIds: readonly VersionCourseId[] = [],
): StudentTrajectory {
  return { completedVersionCourseIds, inProgressVersionCourseIds };
}

describe("calculatePlanProgress", () => {
  it("returns zero progress without completed courses", () => {
    expect(calculatePlanProgress(context([versionCourse(courseAId, 30)]), trajectory(), 120))
      .toEqual({
        completedCredits: 0,
        requiredCredits: 120,
        ratio: 0,
        diagnostics: [],
      });
  });

  it("calculates exact partial progress", () => {
    expect(
      calculatePlanProgress(
        context([versionCourse(courseAId, 30)]),
        trajectory([courseAId]),
        120,
      ).ratio,
    ).toBe(0.25);
  });

  it("returns one at exactly the required credits", () => {
    expect(
      calculatePlanProgress(
        context([versionCourse(courseAId, 70), versionCourse(courseBId, 50)]),
        trajectory([courseAId, courseBId]),
        120,
      ),
    ).toMatchObject({ completedCredits: 120, ratio: 1 });
  });

  it("keeps raw completed credits while clamping excess progress to one", () => {
    expect(
      calculatePlanProgress(
        context([versionCourse(courseAId, 100), versionCourse(courseBId, 30)]),
        trajectory([courseAId, courseBId]),
        120,
      ),
    ).toMatchObject({ completedCredits: 130, requiredCredits: 120, ratio: 1 });
  });

  it("does not count in-progress courses", () => {
    const evaluationContext = context([
      versionCourse(courseAId, 30),
      versionCourse(courseBId, 20),
    ]);
    const withoutInProgress = calculatePlanProgress(
      evaluationContext,
      trajectory([courseAId]),
      120,
    );
    const withInProgress = calculatePlanProgress(
      evaluationContext,
      trajectory([courseAId], [courseBId]),
      120,
    );

    expect(withInProgress).toEqual(withoutInProgress);
    expect(withInProgress.completedCredits).toBe(30);
  });

  it("reports an unresolved completed id without counting it", () => {
    const missingId = "missing-course" as VersionCourseId;
    const result = calculatePlanProgress(
      context([versionCourse(courseAId, 30)]),
      trajectory([courseAId, missingId]),
      120,
    );

    expect(result.completedCredits).toBe(30);
    expect(result.ratio).toBe(0.25);
    expect(result.diagnostics).toEqual([
      {
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: missingId,
      },
    ]);
  });

  it("reports multiple unresolved ids in stable trajectory order", () => {
    const missingBId = "missing-b" as VersionCourseId;
    const missingAId = "missing-a" as VersionCourseId;

    expect(
      calculatePlanProgress(
        context([]),
        trajectory([missingBId, missingAId]),
        120,
      ).diagnostics,
    ).toEqual([
      {
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: missingBId,
      },
      {
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: missingAId,
      },
    ]);
  });

  it("is deterministic for identical input", () => {
    const missingId = "missing-course" as VersionCourseId;
    const evaluationContext = context([
      versionCourse(courseAId, 20),
      versionCourse(courseBId, 15),
      versionCourse(courseCId, 10),
    ]);
    const student = trajectory([courseCId, missingId, courseAId], [courseBId]);

    expect(calculatePlanProgress(evaluationContext, student, 120)).toEqual(
      calculatePlanProgress(evaluationContext, student, 120),
    );
  });
});

describe("calculateSatisfiedPlanProgress", () => {
  const componentAId = "component-a" as ComponentId;
  const componentBId = "component-b" as ComponentId;
  const freeChoiceId = "free-choice" as ComponentId;

  function grouping(id: string, componentId: ComponentId, requiredCredits: number): Grouping {
    return { id: id as GroupingId, componentId, name: id, requiredCredits };
  }

  function component(id: ComponentId, requiredCredits: number): Component {
    return { id, planVersionId, name: id, requiredCredits };
  }

  function course(
    id: string,
    grouping: Grouping,
    credits: number,
    mandatory: boolean,
  ): VersionCourse {
    return {
      id: id as VersionCourseId,
      planVersionId,
      courseId: `catalog-${id}` as CourseId,
      groupingId: grouping.id,
      academicCode: id,
      credits,
      mandatory,
    };
  }

  function evaluated(
    groupings: readonly Grouping[],
    components: readonly Component[],
    courses: readonly VersionCourse[],
    completed: readonly VersionCourse[] = courses,
    inProgress: readonly VersionCourse[] = [],
    planRequiredCredits = components.reduce((total, item) => total + item.requiredCredits, 0),
  ) {
    return calculateSatisfiedPlanProgress(
      { planVersionId, groupings, components, versionCourses: courses },
      trajectory(completed.map((item) => item.id), inProgress.map((item) => item.id)),
      planRequiredCredits,
    );
  }

  function onlyGrouping(result: ReturnType<typeof evaluated>) {
    return result.components[0]!.groupings[0]!;
  }

  it("does not let excess Mathematics electives replace missing mandatory credits", () => {
    const math = grouping("math", componentAId, 44);
    const electives = [course("math-e1", math, 4, false), course("math-e2", math, 4, false)];
    // Use a complete 40-credit mandatory catalog while completing only 36 of it.
    const adjusted = evaluated(
      [math],
      [component(componentAId, 44)],
      [course("m36", math, 36, true), course("m4", math, 4, true), ...electives],
      [course("m36", math, 36, true), ...electives],
    );
    expect(onlyGrouping(adjusted)).toMatchObject({
      rawCredits: 44,
      satisfiedCredits: 40,
      excessCredits: 4,
    });
  });

  it.each([
    [4, 44, 0],
    [24, 44, 20],
  ])("with 40 mandatory and %i elective Mathematics credits satisfies %i", (elective, satisfied, excess) => {
    const math = grouping("math", componentAId, 44);
    const courses = [course("mandatory", math, 40, true), course("electives", math, elective, false)];
    expect(onlyGrouping(evaluated([math], [component(componentAId, 44)], courses))).toMatchObject({
      satisfiedCredits: satisfied,
      excessCredits: excess,
    });
  });

  it("handles a fully mandatory Programming grouping", () => {
    const programming = grouping("programming", componentAId, 9);
    const courses = [course("programming-course", programming, 9, true)];
    expect(onlyGrouping(evaluated([programming], [component(componentAId, 9)], courses))).toMatchObject({
      rawCredits: 9,
      satisfiedCredits: 9,
      excessCredits: 0,
    });
  });

  it.each([["systems", 6, 15, 9], ["applied", 7, 21, 14]])(
    "caps fully elective %s credits at its requirement",
    (name, required, raw, excess) => {
      const item = grouping(name, componentBId, required);
      const courses = [course(`${name}-electives`, item, raw, false)];
      expect(onlyGrouping(evaluated([item], [component(componentBId, required)], courses))).toMatchObject({
        rawCredits: raw,
        satisfiedCredits: required,
        excessCredits: excess,
      });
    },
  );

  it.each([
    ["foundation", 61, [44, 9, 8]],
    ["disciplinary", 56, [19, 16, 6, 7, 8]],
  ])("aggregates the %s component without letting child excess inflate it", (name, required, requirements) => {
    const componentId = name === "foundation" ? componentAId : componentBId;
    const groupings = requirements.map((credits, index) => grouping(`${name}-${index}`, componentId, credits));
    const courses = groupings.map((item, index) => course(`${name}-course-${index}`, item, item.requiredCredits + (index === 0 ? 10 : 0), false));
    const result = evaluated(groupings, [component(componentId, required)], courses).components[0]!;
    expect(result.satisfiedCredits).toBe(required);
    expect(result.rawCredits).toBe(required + 10);
    expect(result.excessCredits).toBe(10);
  });

  it("does not transfer one grouping's excess to another grouping's deficit", () => {
    const algorithms = grouping("algorithms", componentBId, 19);
    const applied = grouping("applied", componentBId, 7);
    const algorithmMandatory = course("algorithm-mandatory", algorithms, 12, true);
    const algorithmElective = course("algorithm-elective", algorithms, 7, false);
    const appliedElectives = course("applied-electives", applied, 17, false);
    const result = evaluated(
      [algorithms, applied],
      [component(componentBId, 26)],
      [algorithmMandatory, algorithmElective, appliedElectives],
      [algorithmMandatory, appliedElectives],
    ).components[0]!;
    expect(result.satisfiedCredits).toBe(19);
    expect(result.rawCredits).toBe(29);
    expect(result.excessCredits).toBe(10);
  });

  it("preserves additivity and diagnoses inconsistent component and plan requirements", () => {
    const first = grouping("first", componentAId, 6);
    const second = grouping("second", componentAId, 5);
    const courses = [course("first-course", first, 6, false), course("second-course", second, 5, false)];
    const result = evaluated([first, second], [component(componentAId, 10)], courses, courses, [], 9);
    const childSum = result.components[0]!.groupings.reduce((total, item) => total + item.satisfiedCredits, 0);
    expect(result.satisfiedCredits).toBe(11);
    expect(result.components[0]!.satisfiedCredits).toBe(childSum);
    expect(result.excessCredits).toBe(result.components.reduce((total, item) => total + item.excessCredits, 0));
    expect(result.diagnostics).toEqual([
      {
        code: "INCONSISTENT_HIERARCHICAL_REQUIRED_CREDITS",
        scope: "COMPONENT",
        scopeId: componentAId,
        requiredCredits: 10,
        childrenRequiredCredits: 11,
      },
      {
        code: "INCONSISTENT_HIERARCHICAL_REQUIRED_CREDITS",
        scope: "PLAN",
        scopeId: planVersionId,
        requiredCredits: 9,
        childrenRequiredCredits: 10,
      },
    ]);
  });

  it("accepts the official hierarchy without hierarchical diagnostics", () => {
    const foundation = component(componentAId, 61);
    const disciplinary = component(componentBId, 56);
    const free = component(freeChoiceId, 29);
    const groupings = [44, 9, 8].map((credits, index) => grouping(`f-${index}`, componentAId, credits))
      .concat([19, 16, 6, 7, 8].map((credits, index) => grouping(`d-${index}`, componentBId, credits)));
    const result = evaluated(groupings, [foundation, disciplinary, free], [], [], [], 146);
    expect(result.diagnostics).toEqual([]);
  });

  it("shares elective capacity between completed and in-progress courses", () => {
    const math = grouping("math", componentAId, 44);
    const completed = [course("mandatory", math, 40, true), course("completed-elective", math, 4, false)];
    const inProgress = course("in-progress-elective", math, 4, false);
    const result = onlyGrouping(evaluated([math], [component(componentAId, 44)], [...completed, inProgress], completed, [inProgress]));
    expect(result.satisfiedCredits).toBe(44);
    expect(result.projectedSatisfiedCredits).toBe(44);
  });

  it("does not infer progress for a component without groupings", () => {
    const free = component(freeChoiceId, 29);
    const result = evaluated([], [free], [], [], [], 29);
    expect(result.components[0]).toMatchObject({ rawCredits: 0, satisfiedCredits: 0, excessCredits: 0 });
    expect(result.satisfiedCredits).toBe(0);
  });

  it("reports and excludes a course whose grouping is unknown", () => {
    const unknown = grouping("unknown", componentAId, 3);
    const orphan = course("orphan", unknown, 3, true);
    const result = evaluated([], [component(componentAId, 3)], [orphan]);
    expect(result.rawCredits).toBe(0);
    expect(result.diagnostics).toContainEqual({
      code: "UNRESOLVED_REFERENCE",
      referenceType: "GROUPING",
      referenceId: unknown.id,
    });
  });

  it("clamps negative elective capacity and reports it", () => {
    const invalid = grouping("invalid", componentAId, 5);
    const mandatory = course("mandatory", invalid, 6, true);
    const elective = course("elective", invalid, 3, false);
    const result = evaluated([invalid], [component(componentAId, 5)], [mandatory, elective]);
    expect(onlyGrouping(result)).toMatchObject({ rawCredits: 9, satisfiedCredits: 6, excessCredits: 3 });
    expect(result.diagnostics).toContainEqual({
      code: "NEGATIVE_ELECTIVE_CREDIT_CAPACITY",
      groupingId: invalid.id,
      requiredCredits: 5,
      mandatoryCredits: 6,
    });
  });
});
