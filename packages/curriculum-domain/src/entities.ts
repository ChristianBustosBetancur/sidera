import type {
  AcademicProgramId,
  ComponentId,
  CourseId,
  CurriculumPlanId,
  GroupingId,
  PlanVersionId,
  UniversityId,
  VersionCourseId,
} from "./identifiers.js";
import type { RequirementExpression } from "./requirements.js";

export type Provenance = "official" | "proposal" | "community";

export type Lifecycle = "draft" | "published" | "archived";

export type University = {
  id: UniversityId;
  name: string;
};

export type AcademicProgram = {
  id: AcademicProgramId;
  universityId: UniversityId;
  name: string;
};

export type CurriculumPlan = {
  id: CurriculumPlanId;
  academicProgramId: AcademicProgramId;
  name: string;
};

export type PlanVersion = {
  id: PlanVersionId;
  curriculumPlanId: CurriculumPlanId;
  name: string;
  provenance: Provenance;
  lifecycle: Lifecycle;
  requiredCredits: number;
};

export type Course = {
  id: CourseId;
  universityId: UniversityId;
  name: string;
};

export type Component = {
  id: ComponentId;
  planVersionId: PlanVersionId;
  name: string;
  requiredCredits: number;
};

export type Grouping = {
  id: GroupingId;
  componentId: ComponentId;
  name: string;
  requiredCredits: number;
};

export type VersionCourse = {
  id: VersionCourseId;
  planVersionId: PlanVersionId;
  courseId: CourseId;
  groupingId: GroupingId;
  academicCode: string;
  credits: number;
  mandatory: boolean;
  requirements?: RequirementExpression;
};
