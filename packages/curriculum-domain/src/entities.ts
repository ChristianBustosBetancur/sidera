import type {
  ComponentId,
  CourseId,
  CurriculumPlanId,
  GroupingId,
  PlanVersionId,
  VersionCourseId,
} from "./identifiers.js";
import type { RequirementExpression } from "./requirements.js";

export type Provenance = "official" | "proposal" | "community";

export type Lifecycle = "draft" | "published" | "archived";

export type CurriculumPlan = {
  id: CurriculumPlanId;
  name: string;
};

export type PlanVersion = {
  id: PlanVersionId;
  curriculumPlanId: CurriculumPlanId;
  name: string;
  provenance: Provenance;
  lifecycle: Lifecycle;
};

export type Course = {
  id: CourseId;
  name: string;
};

export type Component = {
  id: ComponentId;
  planVersionId: PlanVersionId;
  name: string;
};

export type Grouping = {
  id: GroupingId;
  componentId: ComponentId;
  name: string;
};

export type VersionCourse = {
  id: VersionCourseId;
  planVersionId: PlanVersionId;
  courseId: CourseId;
  groupingId: GroupingId;
  academicCode: string;
  credits: number;
  requirements?: RequirementExpression;
};
