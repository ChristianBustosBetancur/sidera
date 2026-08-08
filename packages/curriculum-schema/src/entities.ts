import { z } from "zod";
import type {
  AcademicProgram,
  Component,
  Course,
  CurriculumPlan,
  Grouping,
  PlanVersion,
  University,
  VersionCourse,
} from "@sidera/curriculum-domain";
import {
  academicProgramIdSchema,
  componentIdSchema,
  courseIdSchema,
  curriculumPlanIdSchema,
  groupingIdSchema,
  planVersionIdSchema,
  universityIdSchema,
  versionCourseIdSchema,
} from "./identifiers.js";
import { requirementExpressionSchema } from "./requirements.js";

const nameSchema = z.string().min(1);

export const provenanceSchema = z.enum(["official", "proposal", "community"]);
export const lifecycleSchema = z.enum(["draft", "published", "archived"]);

export const universitySchema: z.ZodType<University> = z.strictObject({
  id: universityIdSchema,
  name: nameSchema,
});

export const academicProgramSchema: z.ZodType<AcademicProgram> = z.strictObject({
  id: academicProgramIdSchema,
  universityId: universityIdSchema,
  name: nameSchema,
});

export const curriculumPlanSchema: z.ZodType<CurriculumPlan> = z.strictObject({
  id: curriculumPlanIdSchema,
  academicProgramId: academicProgramIdSchema,
  name: nameSchema,
});

export const planVersionSchema: z.ZodType<PlanVersion> = z.strictObject({
  id: planVersionIdSchema,
  curriculumPlanId: curriculumPlanIdSchema,
  name: nameSchema,
  provenance: provenanceSchema,
  lifecycle: lifecycleSchema,
  requiredCredits: z.number().int().positive(),
});

export const courseSchema: z.ZodType<Course> = z.strictObject({
  id: courseIdSchema,
  universityId: universityIdSchema,
  name: nameSchema,
});

export const componentSchema: z.ZodType<Component> = z.strictObject({
  id: componentIdSchema,
  planVersionId: planVersionIdSchema,
  name: nameSchema,
  requiredCredits: z.number().int().positive(),
});

export const groupingSchema: z.ZodType<Grouping> = z.strictObject({
  id: groupingIdSchema,
  componentId: componentIdSchema,
  name: nameSchema,
  requiredCredits: z.number().int().positive(),
});

export const versionCourseSchema: z.ZodType<VersionCourse> = z.strictObject({
  id: versionCourseIdSchema,
  planVersionId: planVersionIdSchema,
  courseId: courseIdSchema,
  groupingId: groupingIdSchema,
  academicCode: z.string().min(1),
  credits: z.number().int().nonnegative(),
  mandatory: z.boolean(),
  requirements: requirementExpressionSchema.optional(),
});

export type UniversitySchemaOutput = z.output<typeof universitySchema>;
export type AcademicProgramSchemaOutput = z.output<typeof academicProgramSchema>;
export type CurriculumPlanSchemaOutput = z.output<typeof curriculumPlanSchema>;
export type PlanVersionSchemaOutput = z.output<typeof planVersionSchema>;
export type CourseSchemaOutput = z.output<typeof courseSchema>;
export type ComponentSchemaOutput = z.output<typeof componentSchema>;
export type GroupingSchemaOutput = z.output<typeof groupingSchema>;
export type VersionCourseSchemaOutput = z.output<typeof versionCourseSchema>;
