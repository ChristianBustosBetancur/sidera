import type {
  RequirementExpression,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import type { CurriculumEvaluationContext } from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";

export const evaluationContext: CurriculumEvaluationContext = {
  planVersionId: unalCs2024Official.planVersion.id,
  versionCourses: unalCs2024Official.versionCourses,
  groupings: unalCs2024Official.groupings,
  components: unalCs2024Official.components,
};

export const coursesById = new Map(
  unalCs2024Official.courses.map((course) => [course.id, course]),
);

export const versionCoursesById = new Map(
  unalCs2024Official.versionCourses.map((versionCourse) => [
    versionCourse.id,
    versionCourse,
  ]),
);

export const componentsById = new Map(
  unalCs2024Official.components.map((component) => [component.id, component]),
);

export const groupingsById = new Map(
  unalCs2024Official.groupings.map((grouping) => [grouping.id, grouping]),
);

export function courseReference(versionCourseId: VersionCourseId): string {
  const versionCourse = versionCoursesById.get(versionCourseId);
  const course = versionCourse && coursesById.get(versionCourse.courseId);
  return versionCourse && course
    ? `${versionCourse.academicCode} ${course.name}`
    : "Materia no encontrada";
}

export function requirementLines(
  requirement: RequirementExpression,
): string[] {
  switch (requirement.type) {
    case "COURSE_COMPLETED":
      return [`Prerrequisito: ${courseReference(requirement.versionCourseId)}`];
    case "COURSE_COMPLETED_OR_CONCURRENT":
      return [`Correquisito: ${courseReference(requirement.versionCourseId)}`];
    case "MIN_TOTAL_CREDITS":
      return [`Requisito: ${requirement.credits} créditos aprobados en el plan`];
    case "MIN_COMPONENT_CREDITS": {
      const component = componentsById.get(requirement.componentId);
      return [
        `Requisito: ${requirement.credits} créditos aprobados en ${component?.name ?? "el componente indicado"}`,
      ];
    }
    case "MIN_GROUPING_CREDITS": {
      const grouping = groupingsById.get(requirement.groupingId);
      return [
        `Requisito: ${requirement.credits} créditos aprobados en ${grouping?.name ?? "la agrupación indicada"}`,
      ];
    }
    case "MIN_GROUPING_COURSES": {
      const grouping = groupingsById.get(requirement.groupingId);
      return [
        `Requisito: ${requirement.courseCount} materias aprobadas en ${grouping?.name ?? "la agrupación indicada"}`,
      ];
    }
    case "ALL":
    case "ANY":
    case "AT_LEAST":
      return requirement.children.flatMap(requirementLines);
  }
}
