import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACADEMIC_STORAGE_KEY, emptyAcademicRecords, loadAcademicRecords, saveAcademicRecords } from "./academic-storage";
import { programs, verifiedShared } from "./programs";
import { deactivateDual, previewAcademicMark, previewDualActivation, programRecord, recordTrajectory } from "@sidera/curriculum-engine";
import { programModels } from "./programs";

const cs = programs[0]!;
const math = programs[1]!;
const differential = cs.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!;
const integral = cs.snapshot.versionCourses.find(course => course.academicCode === "1000005-M")!;
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
});
describe("versioned academic storage", () => {
  it("migrates completed and in-progress Computing records without changing the legacy key", () => {
    const old = JSON.stringify({ formatVersion: 1, planVersionId: cs.snapshot.planVersion.id, completedVersionCourseIds: [differential.id, differential.id], inProgressVersionCourseIds: [integral.id] });
    store.set("sidera:student-trajectory", old);
    const loaded = loadAcademicRecords();
    expect(loaded.writable).toBe(true);
    expect(recordTrajectory(programRecord(loaded.records, programModels[0]!), cs.evaluationContext)).toEqual({ completedVersionCourseIds: [differential.id], inProgressVersionCourseIds: [integral.id] });
    expect(saveAcademicRecords(loaded.records)).toBe(true);
    expect(loadAcademicRecords().records).toEqual(loaded.records);
    expect(store.get("sidera:student-trajectory")).toBe(old);
  });
  it("retains each plan, explicit unmarked states and active program across reload", () => {
    let records = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, cs.id, differential.courseId, "COMPLETED").next;
    records = previewAcademicMark(records, programModels, verifiedShared, math.id, differential.courseId, "UNMARKED").next;
    records = { ...records, activeProgram: math.id };
    saveAcademicRecords(records);
    expect(loadAcademicRecords().records).toEqual(records);
    expect(recordTrajectory(programRecord(records, programModels[1]!), math.evaluationContext).completedVersionCourseIds).toEqual([]);
  });
  it("does not fall back to stale legacy data after v2 exists", () => {
    store.set("sidera:student-trajectory", JSON.stringify({ formatVersion: 1, planVersionId: cs.snapshot.planVersion.id, completedVersionCourseIds: [differential.id], inProgressVersionCourseIds: [] }));
    saveAcademicRecords(emptyAcademicRecords());
    expect(loadAcademicRecords().records.plans).toEqual({});
  });
  it.each(['{"formatVersion":3}', '{bad json', '{"formatVersion":2,"plans":null}'])("preserves unsupported or corrupt data: %s", raw => {
    store.set(ACADEMIC_STORAGE_KEY, raw);
    expect(loadAcademicRecords().writable).toBe(false);
    expect(store.get(ACADEMIC_STORAGE_KEY)).toBe(raw);
  });
  it("round trips shared facts, per-plan effects, external completion and deactivation", () => {
    let records = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, math.id, "unal:3007744" as typeof differential.courseId, "COMPLETED").next;
    records = previewDualActivation(records, programModels, verifiedShared).next;
    expect(records.dual).toBe(true);
    saveAcademicRecords(records);
    expect(loadAcademicRecords().records).toEqual(records);
    records = deactivateDual(records);
    saveAcademicRecords(records);
    expect(loadAcademicRecords().records).toEqual(records);
    expect(records.plans[math.snapshot.planVersion.id]!.externalCompleted["unal:3007744"]).toBe(true);
  });
});
