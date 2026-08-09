import type {
  CourseId,
  GroupingId,
  PlanVersionId,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import type { StudentTrajectory } from "@sidera/curriculum-engine";
import { describe, expect, it } from "vitest";
import {
  progressBarPresentation,
  sumInProgressCredits,
} from "./curriculum-data";

const groupingId = "grouping" as GroupingId;
const planVersionId = "plan-version" as PlanVersionId;

function versionCourse(id: string, credits: number): VersionCourse {
  return {
    id: id as VersionCourseId,
    planVersionId,
    courseId: `course-${id}` as CourseId,
    groupingId,
    academicCode: id,
    credits,
    mandatory: true,
  };
}

function trajectory(
  completedVersionCourseIds: readonly VersionCourseId[] = [],
  inProgressVersionCourseIds: readonly VersionCourseId[] = [],
): StudentTrajectory {
  return { completedVersionCourseIds, inProgressVersionCourseIds };
}

describe("sumInProgressCredits", () => {
  it("suma únicamente las materias en curso dentro del alcance", () => {
    const courseA = versionCourse("a", 3);
    const courseB = versionCourse("b", 4);
    const outsideId = "outside" as VersionCourseId;

    expect(
      sumInProgressCredits(
        [courseA, courseB],
        trajectory([], [courseA.id, outsideId]),
      ),
    ).toBe(3);
  });

  it("devuelve cero para un alcance vacío", () => {
    expect(
      sumInProgressCredits([], trajectory([], ["outside" as VersionCourseId])),
    ).toBe(0);
  });
});

describe("progressBarPresentation", () => {
  it("mantiene el porcentaje aprobado separado de los créditos en curso", () => {
    const presentation = progressBarPresentation({
      completedCredits: 32,
      requiredCredits: 44,
      completedRatio: 32 / 44,
      inProgressCredits: 4,
    });

    expect(presentation.completedPercent).toBe(73);
    expect(presentation.inProgressRatio).toBeCloseTo(4 / 44);
    expect(presentation.completedText).toBe("32 / 44 créditos · 73%");
    expect(presentation.inProgressText).toBe("+4 créditos en curso");
  });

  it("recorta a cero el segmento en curso al 100% sin ocultar su valor real", () => {
    const presentation = progressBarPresentation({
      completedCredits: 48,
      requiredCredits: 44,
      completedRatio: 1,
      inProgressCredits: 4,
    });

    expect(presentation.completedRatio).toBe(1);
    expect(presentation.inProgressRatio).toBe(0);
    expect(presentation.completedText).toBe("48 / 44 créditos · 100%");
    expect(presentation.inProgressText).toBe("+4 créditos en curso");
  });

  it("representa un alcance vacío sin segmento ni texto en curso", () => {
    const presentation = progressBarPresentation({
      completedCredits: 0,
      requiredCredits: 44,
      completedRatio: 0,
      inProgressCredits: 0,
    });

    expect(presentation.completedRatio).toBe(0);
    expect(presentation.inProgressRatio).toBe(0);
    expect(presentation.inProgressText).toBeUndefined();
  });
});
