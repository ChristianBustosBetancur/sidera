import { describe, expect, it } from "vitest";
import { unalCs2024Official, unalMathematics2020 } from "@sidera/curriculum-snapshot";
import { deactivateDual, previewAcademicMark, previewDualActivation, type AcademicRecords } from "@sidera/curriculum-engine";
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

/* Clasificación de la activación sobre los catálogos reales. «Sin marcar» es
   ausencia de registro, no una postura que debatir: solo dos estados
   explícitos distintos obligan a elegir. */
describe("dual degree activation over the real catalogs", () => {
  const mark = (records: AcademicRecords, programId: string, courseId: string, state: "COMPLETED" | "IN_PROGRESS") =>
    previewAcademicMark(records, programModels, verifiedShared, programId, courseId as typeof verifiedShared[number], state).next;
  // Sin requisitos en ninguno de los dos planes: así la reconciliación no
  // retira la marca que el caso de prueba acaba de establecer.
  const unconstrained = verifiedShared.filter(id => programModels.every(model => {
    const course = model.context.versionCourses.find(course => course.courseId === id);
    return course !== undefined && course.requirements === undefined;
  }));
  const calculus = programs[0]!.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!.courseId;

  it("shares a marked course over a plan with no record, without asking", () => {
    const records = mark(emptyAcademicRecords(), "computing", calculus, "COMPLETED");
    const before = structuredClone(records);
    const preview = previewDualActivation(records, programModels, verifiedShared);
    expect(preview.conflicts).toEqual([]);
    expect(preview.shared).toContainEqual({ courseId: calculus, mark: "COMPLETED" });
    expect(preview.next.plans[unalMathematics2020.planVersion.id]!.marks[
      programs[1]!.snapshot.versionCourses.find(course => course.courseId === calculus)!.id
    ]).toBe("COMPLETED");
    // Cancelar es no confirmar: previsualizar nunca toca los registros.
    expect(records).toEqual(before);
  });

  it("asks only when both programs hold different explicit states", () => {
    let records = mark(emptyAcademicRecords(), "computing", calculus, "COMPLETED");
    records = mark(records, "mathematics", calculus, "IN_PROGRESS");
    const preview = previewDualActivation(records, programModels, verifiedShared);
    expect(preview.conflicts.map(conflict => conflict.courseId)).toEqual([calculus]);
    expect(preview.conflicts[0]!.states).toEqual([
      { programId: "computing", mark: "COMPLETED" },
      { programId: "mathematics", mark: "IN_PROGRESS" },
    ]);
    expect(preview.shared.some(adoption => adoption.courseId === calculus)).toBe(false);
  });

  it("clears every conflict when one state is applied to all of them", () => {
    const [first, second] = unconstrained;
    expect(second).toBeDefined();
    let records = emptyAcademicRecords();
    for (const courseId of [first!, second!]) {
      records = mark(records, "computing", courseId, "COMPLETED");
      records = mark(records, "mathematics", courseId, "IN_PROGRESS");
    }
    const detected = previewDualActivation(records, programModels, verifiedShared);
    expect(detected.conflicts).toHaveLength(2);
    // «Aplicar a todas» es exactamente esto: un mismo estado para cada conflicto.
    const applied = Object.fromEntries(detected.conflicts.map(conflict => [conflict.courseId, "COMPLETED" as const]));
    const resolved = previewDualActivation(records, programModels, verifiedShared, applied);
    expect(resolved.conflicts).toEqual([]);
    for (const courseId of [first!, second!]) expect(resolved.next.sharedFacts[courseId]).toBe("COMPLETED");
  });

  it("keeps both trajectories when the link is switched off", () => {
    const linked = previewDualActivation(mark(emptyAcademicRecords(), "computing", calculus, "COMPLETED"), programModels, verifiedShared).next;
    const unlinked = deactivateDual(linked);
    expect(unlinked.dual).toBe(false);
    expect(unlinked.plans).toEqual(linked.plans);
    expect(unlinked.sharedFacts).toEqual(linked.sharedFacts);
  });
});
