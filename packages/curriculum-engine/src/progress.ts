import type { VersionCourseId } from "@sidera/curriculum-domain";
import type {
  CurriculumEvaluationContext,
  PlanProgressResult,
  StudentTrajectory,
  UnresolvedReferenceDiagnostic,
} from "./types.js";

export function calculatePlanProgress(
  context: CurriculumEvaluationContext,
  trajectory: StudentTrajectory,
  requiredCredits: number,
): PlanProgressResult {
  const completedVersionCourseIds = new Set(trajectory.completedVersionCourseIds);
  const contextVersionCourseIds = new Set<VersionCourseId>();
  let completedCredits = 0;

  for (const versionCourse of context.versionCourses) {
    contextVersionCourseIds.add(versionCourse.id);
    if (completedVersionCourseIds.has(versionCourse.id)) {
      completedCredits += versionCourse.credits;
    }
  }

  const diagnostics: UnresolvedReferenceDiagnostic[] =
    trajectory.completedVersionCourseIds
      .filter((versionCourseId) => !contextVersionCourseIds.has(versionCourseId))
      .map((versionCourseId) => ({
        code: "UNRESOLVED_REFERENCE",
        referenceType: "VERSION_COURSE",
        referenceId: versionCourseId,
      }));

  return {
    completedCredits,
    requiredCredits,
    ratio: Math.min(completedCredits / requiredCredits, 1),
    diagnostics,
  };
}
