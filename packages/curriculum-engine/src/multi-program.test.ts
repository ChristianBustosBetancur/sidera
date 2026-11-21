import { describe, expect, it } from "vitest";
import type { CourseId, GroupingId, PlanVersionId, VersionCourseId } from "@sidera/curriculum-domain";
import { deactivateDual, previewAcademicMark, previewDualActivation, recordContext, recordTrajectory, type AcademicRecords, type ProgramModel } from "./multi-program.js";
import { calculatePlanProgress } from "./progress.js";
import { evaluateVersionCourseEligibility } from "./evaluation.js";

const shared = "institution:shared" as CourseId;
const exclusive = "institution:exclusive" as CourseId;
const dependent = "institution:dependent" as CourseId;
function model(id: string, prerequisite: boolean): ProgramModel {
  const version = id as PlanVersionId;
  const grouping = `${id}:group` as GroupingId;
  const root = `${id}:root` as VersionCourseId;
  return { id, context: { planVersionId: version, components: [], groupings: [], versionCourses: [
    { id: root, courseId: exclusive, planVersionId: version, groupingId: grouping, academicCode: "exclusive", credits: 4, mandatory: true },
    { id: `${id}:shared` as VersionCourseId, courseId: shared, planVersionId: version, groupingId: grouping, academicCode: "shared", credits: 4, mandatory: true, ...(prerequisite ? { requirements: { type: "COURSE_COMPLETED" as const, versionCourseId: root } } : {}) },
    { id: `${id}:dependent` as VersionCourseId, courseId: dependent, planVersionId: version, groupingId: grouping, academicCode: "dependent", credits: 4, mandatory: false, requirements: { type: "COURSE_COMPLETED", versionCourseId: `${id}:shared` as VersionCourseId } },
  ] } };
}
const a = model("a", false);
const b = model("b", true);
const models = [a, b];
const initial = (): AcademicRecords => ({ formatVersion: 2, activeProgram: "a", dual: false, plans: {}, sharedFacts: {} });
const edit = (records: AcademicRecords, program: string, courseId: CourseId, mark: "COMPLETED" | "IN_PROGRESS" | "UNMARKED") => previewAcademicMark(records, models, [shared], program, courseId, mark);

describe("pure multi-program coordination", () => {
  it("evaluates known external completion without giving it credits, and rejects unknown references", () => {
    const original = a.context.versionCourses[0]!;
    const context = { ...a.context, versionCourses: [{ ...original, requirements: { type: "EXTERNAL_COURSE_COMPLETED" as const, courseId: shared } }], externalCourses: [{ id: shared, name: "Shared external course", universityId: "institution" as import("@sidera/curriculum-domain").UniversityId }], completedExternalCourseIds: [shared] };
    const empty = { completedVersionCourseIds: [], inProgressVersionCourseIds: [] };
    expect(evaluateVersionCourseEligibility(original.id, context, empty).satisfied).toBe(true);
    expect(calculatePlanProgress(context, empty, 140).completedCredits).toBe(0);
    expect(evaluateVersionCourseEligibility(original.id, { ...context, externalCourses: [] }, empty).diagnostics).toContainEqual({ code: "UNRESOLVED_REFERENCE", referenceType: "COURSE", referenceId: shared });
  });
  it("separates trajectories by default and leaves input untouched", () => {
    const records = initial();
    const preview = edit(records, "a", shared, "COMPLETED");
    expect(records).toEqual(initial());
    expect(preview.next.plans.a!.marks["a:shared"]).toBe("COMPLETED");
    expect(preview.next.plans.b).toBeUndefined();
    expect(preview.requiresConfirmation).toBe(false);
  });
  it("previews activation without conflicts, cancellation is mutation-free, confirmation uses exactly next", () => {
    const records = edit(initial(), "a", shared, "COMPLETED").next;
    const before = structuredClone(records);
    const preview = previewDualActivation(records, models, [shared]);
    expect(records).toEqual(before);
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.conflicts).toEqual([]);
    expect(preview.next.plans.b!.marks["b:shared"]).toBe("COMPLETED");
    expect(preview.next.sharedFacts[shared]).toBe("COMPLETED");
    expect(records.dual).toBe(false);
  });
  it("requires resolving completed versus in progress, and applying one state to all clears it", () => {
    let records = edit(initial(), "a", shared, "COMPLETED").next;
    records = edit(records, "b", exclusive, "COMPLETED").next;
    records = edit(records, "b", shared, "IN_PROGRESS").next;
    const before = structuredClone(records);
    const conflict = previewDualActivation(records, models, [shared]);
    expect(conflict.conflicts[0]!.states).toEqual([{ programId: "a", mark: "COMPLETED" }, { programId: "b", mark: "IN_PROGRESS" }]);
    expect(conflict.shared).toEqual([]);
    const resolved = previewDualActivation(records, models, [shared], { [shared]: "COMPLETED" });
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.next.plans.b!.marks["b:shared"]).toBe("COMPLETED");
    expect(records).toEqual(before);
  });
  it.each(["no record at all", "an explicit unmarked"])("shares a marked course over %s without asking", situation => {
    let records = edit(initial(), "a", shared, "COMPLETED").next;
    if (situation !== "no record at all") {
      records = edit(records, "b", exclusive, "COMPLETED").next;
      records = edit(records, "b", shared, "UNMARKED").next;
      expect(records.plans.b!.marks["b:shared"]).toBe("UNMARKED");
    }
    const before = structuredClone(records);
    const preview = previewDualActivation(records, models, [shared]);
    expect(preview.conflicts).toEqual([]);
    expect(preview.shared).toEqual([{ courseId: shared, mark: "COMPLETED" }]);
    expect(preview.next.plans.b!.marks["b:shared"]).toBe("COMPLETED");
    // Previsualizar nunca escribe: cancelar deja los registros intactos.
    expect(records).toEqual(before);
  });
  it("shares facts while reconciling requirements separately without erasing the fact", () => {
    const records = { ...initial(), dual: true };
    const preview = edit(records, "a", shared, "IN_PROGRESS");
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.next.plans.a!.marks["a:shared"]).toBe("IN_PROGRESS");
    expect(preview.next.plans.b!.marks["b:shared"]).toBe("UNMARKED");
    expect(preview.next.sharedFacts[shared]).toBe("IN_PROGRESS");
    expect(preview.reconciliations.find(result => result.programId === "b")!.result.invalidations).toHaveLength(1);
  });
  it("never automatically removes a completed fact with a different prerequisite in another plan", () => {
    const preview = edit({ ...initial(), dual: true }, "a", shared, "COMPLETED");
    expect(preview.next.plans.b!.marks["b:shared"]).toBe("COMPLETED");
    expect(preview.reconciliations.find(result => result.programId === "b")!.result.warnings).toHaveLength(1);
  });
  it("previews cross-plan cascade effects and preserves completed marks", () => {
    let records = edit({ ...initial(), dual: true }, "a", shared, "COMPLETED").next;
    records = edit(records, "a", dependent, "IN_PROGRESS").next;
    records = edit(records, "b", dependent, "COMPLETED").next;
    const preview = edit(records, "a", shared, "UNMARKED");
    expect(preview.next.plans.a!.marks["a:dependent"]).toBe("UNMARKED");
    expect(preview.next.plans.b!.marks["b:dependent"]).toBe("COMPLETED");
    expect(records.plans.a!.marks["a:dependent"]).toBe("IN_PROGRESS");
  });
  it("does not synchronize an exclusive course while linked", () => {
    const preview = edit({ ...initial(), dual: true }, "a", exclusive, "COMPLETED");
    expect(preview.next.plans.b).toBeUndefined();
    expect(preview.next.sharedFacts).toEqual({});
  });
  it("deactivation preserves all trajectories and subsequent edits are independent", () => {
    const records = edit({ ...initial(), dual: true }, "a", shared, "COMPLETED").next;
    const disabled = deactivateDual(records);
    expect(disabled.plans).toEqual(records.plans);
    const next = edit(disabled, "a", shared, "UNMARKED").next;
    expect(next.plans.b!.marks["b:shared"]).toBe("COMPLETED");
    expect(records.dual).toBe(true);
  });
  it("counts the same fact once per plan using independent totals", () => {
    const records = edit({ ...initial(), dual: true }, "a", shared, "COMPLETED").next;
    for (const [model, total] of [[a, 146], [b, 140]] as const) {
      const record = records.plans[model.context.planVersionId]!;
      expect(calculatePlanProgress(recordContext(record, model.context), recordTrajectory(record, model.context), total)).toMatchObject({ completedCredits: 4, requiredCredits: total });
    }
  });
});
