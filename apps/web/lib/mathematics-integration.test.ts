import { describe, expect, it } from "vitest";
import { componentSchema, courseSchema, groupingSchema, planVersionSchema, versionCourseSchema } from "@sidera/curriculum-schema";
import { calculateSatisfiedPlanProgress, evaluateVersionCourseEligibility, type StudentTrajectory } from "@sidera/curriculum-engine";
import { unalMathematics2020 as plan } from "@sidera/curriculum-snapshot";

const context = { planVersionId: plan.planVersion.id, ...plan };
const course = (code: string) => plan.versionCourses.find(course => course.academicCode === code)!;
const trajectory = (...codes: string[]): StudentTrajectory => ({ completedVersionCourseIds: codes.map(code => course(code).id), inProgressVersionCourseIds: [] });

describe("Mathematics snapshot and existing engine integration", () => {
  it("validates all entities through the existing contracts", () => {
    planVersionSchema.parse(plan.planVersion);
    plan.courses.forEach(course => courseSchema.parse(course));
    plan.versionCourses.forEach(course => versionCourseSchema.parse(course));
    plan.groupings.forEach(group => groupingSchema.parse(group));
    plan.components.forEach(component => componentSchema.parse(component));
    expect(plan.versionCourses).toHaveLength(63);
  });
  it("keeps external completion outside the 140-credit plan", () => {
    const empty = trajectory();
    const external = { ...context, completedExternalCourseIds: [plan.externalCourses[0]!.id] };
    expect(plan.versionCourses.some(course => course.academicCode === "3007744")).toBe(false);
    const before = calculateSatisfiedPlanProgress(context, empty, 140);
    const after = calculateSatisfiedPlanProgress(external, empty, 140);
    expect(after).toEqual(before);
    expect(after.requiredCredits).toBe(140);
    expect(after.satisfiedCredits).toBe(0);
    expect(evaluateVersionCourseEligibility(course("3010588").id, context, trajectory("3010391")).satisfied).toBe(false);
    expect(evaluateVersionCourseEligibility(course("3010588").id, external, trajectory("3010391")).satisfied).toBe(true);
    const unknown = evaluateVersionCourseEligibility(course("3010588").id, { ...external, externalCourses: [] }, trajectory("3010391"));
    expect(unknown.satisfied).toBe(false);
    expect(unknown.diagnostics).toContainEqual({ code: "UNRESOLVED_REFERENCE", referenceType: "COURSE", referenceId: "unal:3007744" });
  });
  it("evaluates concurrent analysis for both differential geometry and topology", () => {
    for (const [code, prerequisites] of [["3006890", ["1000003-M", "1000006-M"]], ["3009597", ["3006913"]]] as const) {
      const base = trajectory(...prerequisites);
      expect(evaluateVersionCourseEligibility(course(code).id, context, base).satisfied).toBe(false);
      expect(evaluateVersionCourseEligibility(course(code).id, context, { ...base, inProgressVersionCourseIds: [course("3006887").id] }).satisfied).toBe(true);
    }
  });
  it("requires 40 disciplinary credits for one degree obligation", () => {
    const degree = course("3006946");
    expect(degree.credits).toBe(8);
    expect(plan.versionCourses.some(course => course.academicCode === "3006947")).toBe(false);
    const disciplinary = plan.versionCourses.filter(course => plan.groupings.find(group => group.id === course.groupingId)?.componentId.endsWith("disciplinary") && course !== degree);
    expect(evaluateVersionCourseEligibility(degree.id, context, { completedVersionCourseIds: disciplinary.slice(0, 9).map(course => course.id), inProgressVersionCourseIds: [] }).satisfied).toBe(false);
    expect(evaluateVersionCourseEligibility(degree.id, context, { completedVersionCourseIds: disciplinary.slice(0, 10).map(course => course.id), inProgressVersionCourseIds: [] }).satisfied).toBe(true);
  });
  it("caps electives per grouping and leaves free choice unmodeled", () => {
    const result = calculateSatisfiedPlanProgress(context, { completedVersionCourseIds: plan.versionCourses.map(course => course.id), inProgressVersionCourseIds: [] }, 140);
    expect(result.satisfiedCredits).toBe(112);
    expect(result.diagnostics).toEqual([]);
  });
});
