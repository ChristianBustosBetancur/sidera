import { describe, expect, it } from "vitest";
import {
  academicProgramSchema,
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
  universitySchema,
  versionCourseSchema,
} from "./index.js";

const validVersionCourse = {
  id: "version-course-a",
  planVersionId: "version-a",
  courseId: "course-a",
  groupingId: "grouping-a",
  academicCode: "FIC-101",
  credits: 3,
  mandatory: true,
};

const validPlanVersion = {
  id: "version-a",
  curriculumPlanId: "plan-a",
  name: "Versión ficticia",
  provenance: "official",
  lifecycle: "draft",
  requiredCredits: 120,
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
  it("validates a University and rejects extra fields", () => {
    const university = { id: "university-a", name: "Universidad ficticia" };

    expect(universitySchema.safeParse(university).success).toBe(true);
    expect(universitySchema.safeParse({ ...university, slug: "universidad-ficticia" }).success).toBe(
      false,
    );
  });

  it("validates an AcademicProgram and requires universityId", () => {
    expect(
      academicProgramSchema.safeParse({
        id: "program-a",
        universityId: "university-a",
        name: "Programa ficticio",
      }).success,
    ).toBe(true);
    expect(
      academicProgramSchema.safeParse({ id: "program-a", name: "Programa ficticio" }).success,
    ).toBe(false);
  });

  it("validates a CurriculumPlan and requires academicProgramId", () => {
    expect(
      curriculumPlanSchema.safeParse({
        id: "plan-a",
        academicProgramId: "program-a",
        name: "Plan ficticio",
      }).success,
    ).toBe(true);
    expect(curriculumPlanSchema.safeParse({ id: "plan-a", name: "Plan ficticio" }).success).toBe(
      false,
    );
  });

  it("rejects a denormalized universityId on CurriculumPlan", () => {
    expect(
      curriculumPlanSchema.safeParse({
        id: "plan-a",
        academicProgramId: "program-a",
        universityId: "university-a",
        name: "Plan ficticio",
      }).success,
    ).toBe(false);
  });

  it("validates a Course, requires universityId, and rejects requirements", () => {
    const course = {
      id: "course-a",
      universityId: "university-a",
      name: "Materia ficticia",
    };

    expect(courseSchema.safeParse(course).success).toBe(true);
    expect(courseSchema.safeParse({ id: course.id, name: course.name }).success).toBe(false);
    expect(
      courseSchema.safeParse({
        ...course,
        requirements: { type: "MIN_TOTAL_CREDITS", credits: 3 },
      }).success,
    ).toBe(false);
  });

  it("validates the structural entities", () => {
    expect(planVersionSchema.safeParse(validPlanVersion).success).toBe(true);
    expect(
      componentSchema.safeParse({
        id: "component-a",
        planVersionId: "version-a",
        name: "Componente ficticio",
      }).success,
    ).toBe(true);
  });

  it("requires requiredCredits on PlanVersion", () => {
    const planVersionWithoutRequiredCredits = {
      id: "version-a",
      curriculumPlanId: "plan-a",
      name: "Versión ficticia",
      provenance: "official",
      lifecycle: "draft",
    };

    expect(planVersionSchema.safeParse(planVersionWithoutRequiredCredits).success).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["decimal", 3.5],
    ["non-numeric", "120"],
  ])("rejects %s requiredCredits on PlanVersion", (_description, requiredCredits) => {
    expect(planVersionSchema.safeParse({ ...validPlanVersion, requiredCredits }).success).toBe(
      false,
    );
  });

  it("rejects denormalized ancestors on PlanVersion", () => {
    expect(
      planVersionSchema.safeParse({ ...validPlanVersion, academicProgramId: "program-a" }).success,
    ).toBe(false);
    expect(
      planVersionSchema.safeParse({ ...validPlanVersion, universityId: "university-a" }).success,
    ).toBe(false);
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

  it("accepts mandatory and elective VersionCourse values", () => {
    expect(versionCourseSchema.safeParse(validVersionCourse).success).toBe(true);
    expect(
      versionCourseSchema.safeParse({ ...validVersionCourse, mandatory: false }).success,
    ).toBe(true);
  });

  it("requires a boolean mandatory value on VersionCourse", () => {
    const versionCourseWithoutMandatory = {
      id: "version-course-a",
      planVersionId: "version-a",
      courseId: "course-a",
      groupingId: "grouping-a",
      academicCode: "FIC-101",
      credits: 3,
    };

    expect(versionCourseSchema.safeParse(versionCourseWithoutMandatory).success).toBe(false);
    expect(
      versionCourseSchema.safeParse({ ...validVersionCourse, mandatory: "true" }).success,
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

  it("allows a shared Course to have different requirements in different plan versions", () => {
    const first = versionCourseSchema.safeParse({
      ...validVersionCourse,
      requirements: { type: "MIN_TOTAL_CREDITS", credits: 3 },
    });
    const second = versionCourseSchema.safeParse({
      ...validVersionCourse,
      id: "version-course-b",
      planVersionId: "version-b",
      requirements: { type: "MIN_TOTAL_CREDITS", credits: 6 },
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
