import { describe, expect, it } from "vitest";
import {
  componentSchema,
  courseCompletedOrConcurrentRequirementSchema,
  courseCompletedRequirementSchema,
  courseSchema,
  curriculumPlanSchema,
  groupingSchema,
  lifecycleSchema,
  minimumComponentCreditsRequirementSchema,
  minimumGroupingCoursesRequirementSchema,
  minimumGroupingCreditsRequirementSchema,
  minimumTotalCreditsRequirementSchema,
  planVersionSchema,
  provenanceSchema,
  requirementExpressionSchema,
  requirementLeafSchema,
  versionCourseSchema,
} from "./index.js";

const validVersionCourse = {
  id: "version-course-a",
  planVersionId: "version-a",
  courseId: "course-a",
  groupingId: "grouping-a",
  academicCode: "FIC-101",
  credits: 3,
};

describe("requirement schemas", () => {
  it("validates a single course prerequisite", () => {
    expect(
      requirementExpressionSchema.parse({
        type: "COURSE_COMPLETED",
        versionCourseId: "version-course-a",
      }),
    ).toEqual({
      type: "COURSE_COMPLETED",
      versionCourseId: "version-course-a",
    });
  });

  it("validates a nested ALL containing ANY", () => {
    const result = requirementExpressionSchema.safeParse({
      type: "ALL",
      children: [
        {
          type: "ANY",
          children: [
            { type: "COURSE_COMPLETED", versionCourseId: "version-course-a" },
            { type: "MIN_TOTAL_CREDITS", credits: 12 },
          ],
        },
        { type: "MIN_COMPONENT_CREDITS", componentId: "component-a", credits: 6 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("validates a positive AT_LEAST threshold and rejects non-positive thresholds", () => {
    const expression = {
      type: "AT_LEAST",
      children: [
        { type: "COURSE_COMPLETED", versionCourseId: "version-course-a" },
        { type: "COURSE_COMPLETED", versionCourseId: "version-course-b" },
      ],
    };

    expect(requirementExpressionSchema.safeParse({ ...expression, threshold: 1 }).success).toBe(
      true,
    );
    expect(requirementExpressionSchema.safeParse({ ...expression, threshold: 0 }).success).toBe(
      false,
    );
    expect(requirementExpressionSchema.safeParse({ ...expression, threshold: -1 }).success).toBe(
      false,
    );
  });

  it("validates each of the four core leaf types", () => {
    expect(
      courseCompletedRequirementSchema.safeParse({
        type: "COURSE_COMPLETED",
        versionCourseId: "version-course-a",
      }).success,
    ).toBe(true);
    expect(
      courseCompletedOrConcurrentRequirementSchema.safeParse({
        type: "COURSE_COMPLETED_OR_CONCURRENT",
        versionCourseId: "version-course-a",
      }).success,
    ).toBe(true);
    expect(
      minimumTotalCreditsRequirementSchema.safeParse({
        type: "MIN_TOTAL_CREDITS",
        credits: 12,
      }).success,
    ).toBe(true);
    expect(
      minimumComponentCreditsRequirementSchema.safeParse({
        type: "MIN_COMPONENT_CREDITS",
        componentId: "component-a",
        credits: 6,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown leaf type", () => {
    expect(requirementLeafSchema.safeParse({ type: "UNKNOWN" }).success).toBe(false);
  });

  it("models elective requirements by grouping without fictitious courses", () => {
    const creditRequirement = minimumGroupingCreditsRequirementSchema.parse({
      type: "MIN_GROUPING_CREDITS",
      groupingId: "grouping-electives",
      credits: 9,
    });
    const courseRequirement = minimumGroupingCoursesRequirementSchema.parse({
      type: "MIN_GROUPING_COURSES",
      groupingId: "grouping-electives",
      courseCount: 2,
    });

    expect(creditRequirement.groupingId).toBe("grouping-electives");
    expect(courseRequirement.groupingId).toBe("grouping-electives");
    expect("versionCourseId" in creditRequirement).toBe(false);
    expect("versionCourseId" in courseRequirement).toBe(false);
  });
});

describe("entity schemas", () => {
  it("validates the structural entities", () => {
    expect(curriculumPlanSchema.safeParse({ id: "plan-a", name: "Plan ficticio" }).success).toBe(
      true,
    );
    expect(
      planVersionSchema.safeParse({
        id: "version-a",
        curriculumPlanId: "plan-a",
        name: "Versión ficticia",
        provenance: "official",
        lifecycle: "draft",
      }).success,
    ).toBe(true);
    expect(courseSchema.safeParse({ id: "course-a", name: "Materia ficticia" }).success).toBe(
      true,
    );
    expect(
      componentSchema.safeParse({
        id: "component-a",
        planVersionId: "version-a",
        name: "Componente ficticio",
      }).success,
    ).toBe(true);
  });

  it("validates the hierarchy and rejects componentId on VersionCourse", () => {
    expect(
      groupingSchema.safeParse({
        id: "grouping-a",
        componentId: "component-a",
        name: "Agrupación ficticia",
      }).success,
    ).toBe(true);
    expect(versionCourseSchema.safeParse(validVersionCourse).success).toBe(true);
    expect(
      versionCourseSchema.safeParse({
        ...validVersionCourse,
        componentId: "component-a",
      }).success,
    ).toBe(false);
  });

  it("validates MIN_COMPONENT_CREDITS against a Component", () => {
    const result = minimumComponentCreditsRequirementSchema.parse({
      type: "MIN_COMPONENT_CREDITS",
      componentId: "component-a",
      credits: 6,
    });

    expect(result.componentId).toBe("component-a");
    expect("groupingId" in result).toBe(false);
  });

  it("allows the same academic code in different plan versions", () => {
    const first = versionCourseSchema.safeParse(validVersionCourse);
    const second = versionCourseSchema.safeParse({
      ...validVersionCourse,
      id: "version-course-b",
      planVersionId: "version-b",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("validates provenance and lifecycle independently", () => {
    for (const provenance of ["official", "proposal", "community"]) {
      expect(provenanceSchema.safeParse(provenance).success).toBe(true);
    }
    for (const lifecycle of ["draft", "published", "archived"]) {
      expect(lifecycleSchema.safeParse(lifecycle).success).toBe(true);
    }

    expect(provenanceSchema.safeParse("published").success).toBe(false);
    expect(lifecycleSchema.safeParse("official").success).toBe(false);
  });
});
