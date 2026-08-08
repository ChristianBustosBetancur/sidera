declare const opaqueId: unique symbol;

export type OpaqueId<Name extends string> = string & {
  readonly [opaqueId]: Name;
};

export type UniversityId = OpaqueId<"UniversityId">;
export type AcademicProgramId = OpaqueId<"AcademicProgramId">;
export type CurriculumPlanId = OpaqueId<"CurriculumPlanId">;
export type PlanVersionId = OpaqueId<"PlanVersionId">;
export type CourseId = OpaqueId<"CourseId">;
export type VersionCourseId = OpaqueId<"VersionCourseId">;
export type ComponentId = OpaqueId<"ComponentId">;
export type GroupingId = OpaqueId<"GroupingId">;
