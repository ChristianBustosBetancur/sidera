import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateSatisfiedPlanProgress, deactivateDual, deriveVersionCourseState, previewAcademicMark, previewDualActivation, programRecord, recordContext, recordTrajectory } from "@sidera/curriculum-engine";
import { emptyAcademicRecords, loadAcademicRecords, saveAcademicRecords } from "./academic-storage";
import { programModels, programs, verifiedShared } from "./programs";
import { repairSharedFacts } from "./shared-fact-repair";

const course = (program: string, code: string) => programs.find(entry => entry.id === program)!.snapshot.versionCourses.find(entry => entry.academicCode === code)!;
const edit = (records: ReturnType<typeof emptyAcademicRecords>, program: string, code: string, mark: "COMPLETED" | "IN_PROGRESS" | "UNMARKED") =>
  previewAcademicMark(records, programModels, verifiedShared, program, course(program, code).courseId, mark);

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});

describe.each(["computing", "mathematics"])("dual reconciliation with %s as origin", origin => {
  const simulated = origin === "computing" ? "mathematics" : "computing";
  const prerequisite = origin === "computing" ? "3006934" : "3010394";

  it("previews without mutation, then persists the exact coherent result and warning after confirmation and reload", () => {
    let records = edit(emptyAcademicRecords(), origin, prerequisite, "COMPLETED").next;
    records = { ...edit(records, origin, "3008082", "IN_PROGRESS").next, originProgram: origin, activeProgram: origin };
    saveAcademicRecords(records);
    const before = structuredClone(records);
    const preview = previewDualActivation(records, programModels, verifiedShared);
    expect(records).toEqual(before);
    expect(loadAcademicRecords().records).toEqual(before); // cancellation never applies a preview
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.conflicts).toEqual([]);

    for (const model of programModels) {
      const record = programRecord(preview.next, model);
      const actualTrajectory = recordTrajectory(record, model.context);
      const result = preview.reconciliations.find(entry => entry.programId === model.id)!.result;
      expect(result.nextTrajectory).toEqual(actualTrajectory);
      expect(deriveVersionCourseState(course(model.id, "3008082").id, recordContext(record, model.context), actualTrajectory).state).toBe("IN_PROGRESS");
      const progressFromResult = calculateSatisfiedPlanProgress(recordContext(record, model.context), result.nextTrajectory, programs.find(entry => entry.id === model.id)!.snapshot.planVersion.requiredCredits);
      expect(progressFromResult).toEqual(calculateSatisfiedPlanProgress(recordContext(record, model.context), actualTrajectory, progressFromResult.requiredCredits));
      expect(progressFromResult.projectedSatisfiedCredits - progressFromResult.satisfiedCredits).toBe(4);
      if (model.id === simulated) {
        expect(result.invalidations).toEqual([]);
        expect(result.warnings).toContainEqual(expect.objectContaining({ versionCourseId: course(simulated, "3008082").id, mark: "IN_PROGRESS" }));
      }
    }
    saveAcademicRecords(preview.next); // confirmation applies the snapshot, without recomputation
    const loaded = loadAcademicRecords().records;
    expect(loaded).toEqual(preview.next);
    expect(repairSharedFacts(loaded, programModels).restored).toEqual([]);
  });

  it("requires confirmation for ordinary withdrawals after deactivation and preserves records when cancelled", () => {
    let records = edit(emptyAcademicRecords(), origin, prerequisite, "COMPLETED").next;
    const otherPrerequisite = simulated === "mathematics" ? "3010394" : "3006934";
    records = edit(records, simulated, otherPrerequisite, "COMPLETED").next;
    records = edit(records, origin, "3008082", "IN_PROGRESS").next;
    records = deactivateDual(previewDualActivation({ ...records, originProgram: origin }, programModels, verifiedShared).next);
    saveAcademicRecords(records);
    const preview = edit(records, simulated, otherPrerequisite, "UNMARKED");
    expect(preview.requiresConfirmation).toBe(true);
    expect(loadAcademicRecords().records).toEqual(records);
    expect(programRecord(records, programModels.find(entry => entry.id === simulated)!).marks[course(simulated, "3008082").id]).toBe("IN_PROGRESS");
    const result = preview.reconciliations.find(entry => entry.programId === simulated)!.result;
    expect(result.invalidations.map(item => item.versionCourseId)).toContain(course(simulated, "3008082").id);
    expect(result.nextTrajectory).toEqual(recordTrajectory(programRecord(preview.next, programModels.find(entry => entry.id === simulated)!), programModels.find(entry => entry.id === simulated)!.context));
    saveAcademicRecords(preview.next);
    expect(loadAcademicRecords().records).toEqual(preview.next);
    expect(preview.next.sharedFacts[course(origin, "3008082").courseId]).toBe("IN_PROGRESS");
  });
});
