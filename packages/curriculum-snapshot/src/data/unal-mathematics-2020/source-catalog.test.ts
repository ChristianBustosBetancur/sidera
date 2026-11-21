import { describe, expect, it } from "vitest";
import { sourceCourseSchema } from "@sidera/curriculum-schema";
import { mathematicsComponents, mathematicsExternalReferences, mathematicsGroupings, mathematicsPendingAlternatives, mathematicsSourceCourses } from "./source-catalog.js";

const byCode = new Map(mathematicsSourceCourses.map(course => [course.code, course]));

describe("Acuerdo 038 de 2020 source transcription", () => {
  it("validates every source row and keeps codes unique and groupings valid", () => {
    expect(byCode.size).toBe(mathematicsSourceCourses.length);
    for (const course of mathematicsSourceCourses) {
      expect(sourceCourseSchema.safeParse(course).success, course.code).toBe(true);
      expect(mathematicsGroupings.some(grouping => grouping.key === course.grouping)).toBe(true);
      expect(new Set(course.prerequisites).size).toBe(course.prerequisites.length);
      expect(new Set(course.corequisites).size).toBe(course.corequisites.length);
    }
  });
  it("requires 140 credits without summing the entire elective offering", () => {
    expect(mathematicsComponents.map(component => component.requiredCredits)).toEqual([48, 64, 28]);
    expect(mathematicsComponents.reduce((sum, component) => sum + component.requiredCredits, 0)).toBe(140);
    expect(mathematicsGroupings.map(grouping => grouping.requiredCredits)).toEqual([8, 4, 36, 4, 28, 16, 8, 8]);
    for (const component of mathematicsComponents.filter(component => component.key !== "free-choice")) {
      const groups = mathematicsGroupings.filter(grouping => grouping.component === component.key);
      expect(groups.reduce((sum, grouping) => sum + grouping.requiredCredits, 0)).toBe(component.requiredCredits);
      const mandatory = mathematicsSourceCourses.filter(course => course.mandatory && groups.some(grouping => grouping.key === course.grouping));
      expect(mandatory.reduce((sum, course) => sum + course.credits, 0)).toBe(component.mandatoryCredits);
    }
    expect(mathematicsSourceCourses.reduce((sum, course) => sum + course.credits, 0)).toBeGreaterThan(140);
  });
  it("resolves references internally or to the explicitly documented external course", () => {
    const external = new Set<string>(mathematicsExternalReferences.map(course => course.code));
    const externalReferences: string[] = [];
    for (const course of mathematicsSourceCourses) {
      for (const code of [...course.prerequisites, ...course.corequisites]) {
        expect(byCode.has(code) || external.has(code), `${course.code} requires ${code}`).toBe(true);
        if (!byCode.has(code)) externalReferences.push(code);
      }
    }
    expect(externalReferences).toEqual(["3007744"]);
    expect(byCode.get("3010588")?.prerequisites).toEqual(["3010391", "3007744"]);
  });
  it("preserves the two explicit concurrent requirements and their prerequisites", () => {
    expect(byCode.get("3006890")?.corequisites).toEqual(["3006887"]);
    expect(byCode.get("3006890")?.prerequisites).toEqual(["1000003-M", "1000006-M"]);
    expect(byCode.get("3009597")?.corequisites).toEqual(["3006887"]);
    expect(byCode.get("3009597")?.prerequisites).toEqual(["3006913"]);
    expect(mathematicsSourceCourses.filter(course => course.corequisites.length > 0)).toHaveLength(2);
  });
  it("does not import prerequisites from another program with the same course code", () => {
    expect(byCode.get("1000003-M")?.prerequisites).toEqual([]);
    expect(byCode.get("1000007-M")?.prerequisites).toEqual(["1000005-M", "1000003-M"]);
    expect(byCode.get("3006900")?.prerequisites).toEqual([]);
    expect(byCode.get("3008082")?.prerequisites).toEqual(["3010394"]);
  });
  it("keeps the 40-credit gate and does not create a second degree-work obligation", () => {
    expect(byCode.get("3006946")).toMatchObject({ credits: 8, minimumDisciplinaryCredits: 40, mandatory: true });
    expect(byCode.has("3006947")).toBe(false);
    expect(mathematicsPendingAlternatives[0]).toMatchObject({ code: "3006947", alternativeTo: "3006946" });
    expect(mathematicsSourceCourses.filter(course => course.grouping === "degree")).toHaveLength(1);
  });
  it("has no cycles among prerequisites or concurrent course dependencies", () => {
    const visiting = new Set<string>(); const done = new Set<string>();
    const visit = (code: string) => {
      if (done.has(code) || !byCode.has(code)) return;
      expect(visiting.has(code), `cycle at ${code}`).toBe(false);
      visiting.add(code);
      const course = byCode.get(code)!;
      for (const dependency of [...course.prerequisites, ...course.corequisites]) visit(dependency);
      visiting.delete(code); done.add(code);
    };
    for (const code of byCode.keys()) visit(code);
  });
});
