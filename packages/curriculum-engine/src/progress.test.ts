import { describe, expect, it } from "vitest";
import type {
  CourseId,
  GroupingId,
  PlanVersionId,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import { calculatePlanProgress } from "./index.js";
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
