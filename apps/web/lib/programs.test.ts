import { describe, expect, it } from "vitest";
import { unalCs2024Official, unalMathematics2020 } from "@sidera/curriculum-snapshot";
import { previewAcademicMark, previewDualActivation } from "@sidera/curriculum-engine";
import { emptyAcademicRecords } from "./academic-storage";
import { programs, programModels, verifiedShared } from "./programs";
import { buildCurriculumGraph } from "./curriculum-graph";

describe("program registry and visual metadata", () => {
  it("preserves Computing and orders Mathematics groupings without changing academic data or graph levels", () => {
    expect(programs[0]!.snapshot).toBe(unalCs2024Official);
    const math = programs[1]!.snapshot;
    expect(math.groupings.map(group => group.name)).toEqual(["Matemática", "Fundamentación en Física", "Geometría Básica", "Análisis y Topología", "Álgebra y Lógica", "Matemática Aplicada", "Electivas Disciplinares", "Trabajo de Grado"]);
    expect(math.versionCourses).toBe(unalMathematics2020.versionCourses);
    expect(buildCurriculumGraph(math.versionCourses)).toEqual(buildCurriculumGraph(unalMathematics2020.versionCourses));
    expect(math.components).toBe(unalMathematics2020.components);
    expect([...math.groupings].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...unalMathematics2020.groupings].sort((a, b) => a.id.localeCompare(b.id)));
  });
  it("uses 28 verified full-code, credit-compatible internal correspondences and one external prerequisite", () => {
    expect(verifiedShared).toHaveLength(29);
    for (const id of verifiedShared.filter(id => id !== "unal:3007744")) {
      const a = programs[0]!.snapshot.versionCourses.find(course => course.courseId === id)!;
      const b = programs[1]!.snapshot.versionCourses.find(course => course.courseId === id)!;
      expect(a.academicCode).toBe(b.academicCode);
      expect(a.credits).toBe(b.credits);
    }
    expect(verifiedShared.some(id => id === "unal:3006934" || id === "unal:3010394")).toBe(false);
  });
  it("does not keep an external prerequisite completed after the shared fact moves to in progress", () => {
    const id = unalMathematics2020.externalCourses[0]!.id;
    let records = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, "mathematics", id, "COMPLETED").next;
    records = previewDualActivation(records, programModels, verifiedShared).next;
    const preview = previewAcademicMark(records, programModels, verifiedShared, "computing", id, "IN_PROGRESS");
    expect(preview.next.plans[unalMathematics2020.planVersion.id]!.externalCompleted[id]).toBeUndefined();
    expect(preview.next.sharedFacts[id]).toBe("IN_PROGRESS");
    expect(records.plans[unalMathematics2020.planVersion.id]!.externalCompleted[id]).toBe(true);
  });
});
