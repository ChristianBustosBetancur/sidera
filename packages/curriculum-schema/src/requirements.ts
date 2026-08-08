import { z } from "zod";
import type {
  RequirementExpression,
  RequirementLeaf,
} from "@sidera/curriculum-domain";
import {
  componentIdSchema,
  groupingIdSchema,
  versionCourseIdSchema,
} from "./identifiers.js";

const positiveIntegerSchema = z.number().int().positive();

export const courseCompletedRequirementSchema = z.strictObject({
  type: z.literal("COURSE_COMPLETED"),
  versionCourseId: versionCourseIdSchema,
});

export const courseCompletedOrConcurrentRequirementSchema = z.strictObject({
  type: z.literal("COURSE_COMPLETED_OR_CONCURRENT"),
  versionCourseId: versionCourseIdSchema,
});

export const minimumTotalCreditsRequirementSchema = z.strictObject({
  type: z.literal("MIN_TOTAL_CREDITS"),
  credits: positiveIntegerSchema,
});

export const minimumComponentCreditsRequirementSchema = z.strictObject({
  type: z.literal("MIN_COMPONENT_CREDITS"),
  componentId: componentIdSchema,
  credits: positiveIntegerSchema,
});

export const minimumGroupingCreditsRequirementSchema = z.strictObject({
  type: z.literal("MIN_GROUPING_CREDITS"),
  groupingId: groupingIdSchema,
  credits: positiveIntegerSchema,
});

export const minimumGroupingCoursesRequirementSchema = z.strictObject({
  type: z.literal("MIN_GROUPING_COURSES"),
  groupingId: groupingIdSchema,
  courseCount: positiveIntegerSchema,
});

export const requirementLeafSchema: z.ZodType<RequirementLeaf> =
  z.discriminatedUnion("type", [
    courseCompletedRequirementSchema,
    courseCompletedOrConcurrentRequirementSchema,
    minimumTotalCreditsRequirementSchema,
    minimumComponentCreditsRequirementSchema,
    minimumGroupingCreditsRequirementSchema,
    minimumGroupingCoursesRequirementSchema,
  ]);

export const requirementExpressionSchema: z.ZodType<RequirementExpression> = z.lazy(
  () =>
    z.discriminatedUnion("type", [
      courseCompletedRequirementSchema,
      courseCompletedOrConcurrentRequirementSchema,
      minimumTotalCreditsRequirementSchema,
      minimumComponentCreditsRequirementSchema,
      minimumGroupingCreditsRequirementSchema,
      minimumGroupingCoursesRequirementSchema,
      z.strictObject({
        type: z.literal("ALL"),
        children: z.array(requirementExpressionSchema).min(1),
      }),
      z.strictObject({
        type: z.literal("ANY"),
        children: z.array(requirementExpressionSchema).min(1),
      }),
      z.strictObject({
        type: z.literal("AT_LEAST"),
        threshold: positiveIntegerSchema,
        children: z.array(requirementExpressionSchema).min(1),
      }),
    ]),
);

export type RequirementLeafSchemaOutput = z.output<typeof requirementLeafSchema>;
export type RequirementExpressionSchemaOutput = z.output<
  typeof requirementExpressionSchema
>;
