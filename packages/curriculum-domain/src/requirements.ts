import type { ComponentId, GroupingId, VersionCourseId } from "./identifiers.js";

export type CourseCompletedRequirement = {
  type: "COURSE_COMPLETED";
  versionCourseId: VersionCourseId;
};

export type CourseCompletedOrConcurrentRequirement = {
  type: "COURSE_COMPLETED_OR_CONCURRENT";
  versionCourseId: VersionCourseId;
};

export type MinimumTotalCreditsRequirement = {
  type: "MIN_TOTAL_CREDITS";
  credits: number;
};

export type MinimumComponentCreditsRequirement = {
  type: "MIN_COMPONENT_CREDITS";
  componentId: ComponentId;
  credits: number;
};

export type MinimumGroupingCreditsRequirement = {
  type: "MIN_GROUPING_CREDITS";
  groupingId: GroupingId;
  credits: number;
};

export type MinimumGroupingCoursesRequirement = {
  type: "MIN_GROUPING_COURSES";
  groupingId: GroupingId;
  courseCount: number;
};

export type RequirementLeaf =
  | CourseCompletedRequirement
  | CourseCompletedOrConcurrentRequirement
  | MinimumTotalCreditsRequirement
  | MinimumComponentCreditsRequirement
  | MinimumGroupingCreditsRequirement
  | MinimumGroupingCoursesRequirement;

export type AllRequirement = {
  type: "ALL";
  children: RequirementExpression[];
};

export type AnyRequirement = {
  type: "ANY";
  children: RequirementExpression[];
};

export type AtLeastRequirement = {
  type: "AT_LEAST";
  threshold: number;
  children: RequirementExpression[];
};

export type RequirementExpression =
  | RequirementLeaf
  | AllRequirement
  | AnyRequirement
  | AtLeastRequirement;

export function courseCompleted(
  versionCourseId: VersionCourseId,
): CourseCompletedRequirement {
  return {
    type: "COURSE_COMPLETED",
    versionCourseId,
  };
}
