import type { AcademicProgramId, ComponentId, CourseId, CurriculumPlanId, GroupingId, PlanVersionId, RequirementExpression, VersionCourse, VersionCourseId } from "@sidera/curriculum-domain";
import { university, unalCs2024Official } from "../unal-cs-2024-official/index.js";
import { mathematicsComponents, mathematicsGroupings, mathematicsSourceCourses, mathematicsSource, mathematicsPendingAlternatives } from "./source-catalog.js";

const planVersionId = "unal-mathematics-medellin-acuerdo-0038-2020" as PlanVersionId;
const componentId = (key: string) => `unal-mathematics-2020-${key}` as ComponentId;
const groupingId = (key: string) => `unal-mathematics-2020-${key}` as GroupingId;
const versionId = (code: string) => `unal-mathematics-2020:${code}` as VersionCourseId;
const internal = new Set(mathematicsSourceCourses.map(course => course.code));

const versionCourses: VersionCourse[] = mathematicsSourceCourses.map(course => {
  const children: RequirementExpression[] = [
    ...course.prerequisites.map((code): RequirementExpression => internal.has(code)
      ? { type: "COURSE_COMPLETED", versionCourseId: versionId(code) }
      : { type: "EXTERNAL_COURSE_COMPLETED", courseId: `unal:${code}` as CourseId }),
    ...course.corequisites.map((code): RequirementExpression => ({ type: "COURSE_COMPLETED_OR_CONCURRENT", versionCourseId: versionId(code) })),
    ...(course.minimumDisciplinaryCredits ? [{ type: "MIN_COMPONENT_CREDITS" as const, componentId: componentId("disciplinary"), credits: course.minimumDisciplinaryCredits }] : []),
  ];
  const requirements = children.length > 1 ? { type: "ALL" as const, children } : children[0];
  return { id: versionId(course.code), planVersionId, courseId: `unal:${course.code}` as CourseId, groupingId: groupingId(course.grouping), academicCode: course.code, credits: course.credits, mandatory: course.mandatory, ...(requirements ? { requirements } : {}) };
});

export const unalMathematics2020 = {
  university,
  academicProgram: { id: "unal-mathematics-medellin" as AcademicProgramId, universityId: university.id, name: "Matemáticas (Sede Medellín)" },
  curriculumPlan: { id: "unal-mathematics-medellin" as CurriculumPlanId, academicProgramId: "unal-mathematics-medellin" as AcademicProgramId, name: "Matemáticas (Sede Medellín)" },
  planVersion: { id: planVersionId, curriculumPlanId: "unal-mathematics-medellin" as CurriculumPlanId, name: "Acuerdo 038 de 2020", requiredCredits: 140, provenance: "official" as const, lifecycle: "draft" as const },
  components: mathematicsComponents.map(component => ({ id: componentId(component.key), planVersionId, name: component.name, requiredCredits: component.requiredCredits })),
  groupings: mathematicsGroupings.map(grouping => ({ id: groupingId(grouping.key), componentId: componentId(grouping.component), name: grouping.name, requiredCredits: grouping.requiredCredits })),
  courses: mathematicsSourceCourses.map(course => ({ id: `unal:${course.code}` as CourseId, universityId: university.id, name: course.name })),
  versionCourses,
  externalCourses: unalCs2024Official.courses.filter(course => course.id === "unal:3007744"),
  source: mathematicsSource,
  pendingAlternatives: mathematicsPendingAlternatives,
};
