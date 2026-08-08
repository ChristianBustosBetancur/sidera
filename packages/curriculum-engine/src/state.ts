import type { VersionCourseId } from "@curriculum-universe/curriculum-domain";
import { evaluateVersionCourseEligibility } from "./evaluation.js";
import type {
  CurriculumEvaluationContext,
  DerivedCourseStateResult,
  StudentTrajectory,
} from "./types.js";

export function deriveVersionCourseState(
  versionCourseId: VersionCourseId,
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
): DerivedCourseStateResult {
  if (trajectory.completedVersionCourseIds.includes(versionCourseId)) {
    return { state: "COMPLETED" };
  }

  if (trajectory.inProgressVersionCourseIds.includes(versionCourseId)) {
    return { state: "IN_PROGRESS" };
  }

  const eligibility = evaluateVersionCourseEligibility(versionCourseId, context, trajectory);
  return eligibility.satisfied
    ? { state: "AVAILABLE", eligibility }
    : { state: "BLOCKED", eligibility };
}
