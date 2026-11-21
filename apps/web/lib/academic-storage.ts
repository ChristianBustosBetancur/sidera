import type { AcademicRecords } from "@sidera/curriculum-engine";
import { academicRecordsSchema } from "@sidera/curriculum-schema";
import { programs } from "./programs";
import { loadTrajectory } from "./trajectory-storage";

export const ACADEMIC_STORAGE_KEY = "sidera:academic-records:v2";
export function emptyAcademicRecords(): AcademicRecords {
  return { formatVersion: 2, activeProgram: "computing", dual: false, plans: {}, sharedFacts: {} };
}

export function loadAcademicRecords(): { records: AcademicRecords; writable: boolean } {
  try {
    const raw = localStorage.getItem(ACADEMIC_STORAGE_KEY);
    if (raw !== null) {
      const parsed = academicRecordsSchema.safeParse(JSON.parse(raw));
      if (parsed.success && programs.some(program => program.id === parsed.data.activeProgram)) return { records: parsed.data, writable: true };
      // Preserve an unsupported/newer or damaged payload, rather than replacing it.
      return { records: emptyAcademicRecords(), writable: false };
    }
    const legacy = loadTrajectory();
    const records = emptyAcademicRecords();
    records.plans[programs[0]!.snapshot.planVersion.id] = {
      marks: Object.fromEntries([
        ...legacy.inProgressVersionCourseIds.map(id => [id, "IN_PROGRESS" as const]),
        ...legacy.completedVersionCourseIds.map(id => [id, "COMPLETED" as const]),
      ]),
      externalCompleted: {},
    };
    return { records, writable: true };
  } catch {
    return { records: emptyAcademicRecords(), writable: false };
  }
}

export function saveAcademicRecords(records: AcademicRecords): boolean {
  try {
    localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(academicRecordsSchema.parse(records)));
    return true;
  } catch {
    return false;
  }
}
