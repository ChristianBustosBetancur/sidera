import type { VersionCourseId } from "@sidera/curriculum-domain";
import type { StudentTrajectory } from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";

const STORAGE_KEY = "sidera:student-trajectory";
const STORAGE_FORMAT_VERSION = 1;

const EMPTY_TRAJECTORY: StudentTrajectory = {
  completedVersionCourseIds: [],
  inProgressVersionCourseIds: [],
};

const versionCourseIds = new Set<VersionCourseId>(
  unalCs2024Official.versionCourses.map((versionCourse) => versionCourse.id),
);

type StoredTrajectory = {
  formatVersion: number;
  planVersionId: string;
  completedVersionCourseIds: string[];
  inProgressVersionCourseIds: string[];
};

function isStoredTrajectory(value: unknown): value is StoredTrajectory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.formatVersion === STORAGE_FORMAT_VERSION &&
    candidate.planVersionId === unalCs2024Official.planVersion.id &&
    Array.isArray(candidate.completedVersionCourseIds) &&
    candidate.completedVersionCourseIds.every((id) => typeof id === "string") &&
    Array.isArray(candidate.inProgressVersionCourseIds) &&
    candidate.inProgressVersionCourseIds.every((id) => typeof id === "string")
  );
}

function existingVersionCourseIds(ids: string[]): VersionCourseId[] {
  return ids.filter((id): id is VersionCourseId =>
    versionCourseIds.has(id as VersionCourseId),
  );
}

export function loadTrajectory(): StudentTrajectory {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return EMPTY_TRAJECTORY;
    }

    const stored: unknown = JSON.parse(serialized);
    if (!isStoredTrajectory(stored)) {
      return EMPTY_TRAJECTORY;
    }

    const completedVersionCourseIds = existingVersionCourseIds(
      stored.completedVersionCourseIds,
    );
    const inProgressVersionCourseIds = existingVersionCourseIds(
      stored.inProgressVersionCourseIds,
    );

    if (
      completedVersionCourseIds.length === 0 &&
      inProgressVersionCourseIds.length === 0
    ) {
      return EMPTY_TRAJECTORY;
    }

    return {
      completedVersionCourseIds,
      inProgressVersionCourseIds,
    };
  } catch {
    return EMPTY_TRAJECTORY;
  }
}

export function saveTrajectory(trajectory: StudentTrajectory): void {
  try {
    const stored: StoredTrajectory = {
      formatVersion: STORAGE_FORMAT_VERSION,
      planVersionId: unalCs2024Official.planVersion.id,
      completedVersionCourseIds: [...trajectory.completedVersionCourseIds],
      inProgressVersionCourseIds: [...trajectory.inProgressVersionCourseIds],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Persistence is optional; the in-memory trajectory remains usable.
  }
}
