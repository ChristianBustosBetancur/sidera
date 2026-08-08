import { z } from "zod";
import type {
  AcademicProgramId,
  ComponentId,
  CourseId,
  CurriculumPlanId,
  GroupingId,
  PlanVersionId,
  UniversityId,
  VersionCourseId,
} from "@sidera/curriculum-domain";

function opaqueIdSchema<Id extends string>() {
  return z.string().min(1).transform((value) => value as Id);
}

export const universityIdSchema = opaqueIdSchema<UniversityId>();
export const academicProgramIdSchema = opaqueIdSchema<AcademicProgramId>();
export const curriculumPlanIdSchema = opaqueIdSchema<CurriculumPlanId>();
export const planVersionIdSchema = opaqueIdSchema<PlanVersionId>();
export const courseIdSchema = opaqueIdSchema<CourseId>();
export const versionCourseIdSchema = opaqueIdSchema<VersionCourseId>();
export const componentIdSchema = opaqueIdSchema<ComponentId>();
export const groupingIdSchema = opaqueIdSchema<GroupingId>();
