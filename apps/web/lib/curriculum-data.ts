import type {
  ComponentId,
  Lifecycle,
  Provenance,
  RequirementExpression,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  collectBlockingEvaluations,
  type ComponentCreditProgress,
  type CreditProgress,
  type CurriculumEvaluationContext,
  type RequirementEvaluationNode,
} from "@sidera/curriculum-engine";
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

export interface ProgressBarPresentation {
  completedPercent: number;
  completedRatio: number;
  inProgressRatio: number;
  completedText: string;
  inProgressText?: string;
  ariaLabel: string;
}

export interface ProgressBarArguments {
  completedCredits: number;
  requiredCredits: number;
  completedRatio: number;
  inProgressCredits: number;
}

export function satisfiedProgressBarArguments(
  progress: CreditProgress,
  requiredCredits: number,
): ProgressBarArguments {
  return {
    completedCredits: progress.satisfiedCredits,
    requiredCredits,
    completedRatio:
      requiredCredits > 0 ? progress.satisfiedCredits / requiredCredits : 0,
    inProgressCredits: Math.max(
      progress.projectedSatisfiedCredits - progress.satisfiedCredits,
      0,
    ),
  };
}

export type ProgressStage =
  | "progressStageBlue"
  | "progressStageCyan"
  | "progressStageEmerald"
  | "progressStageViolet"
  | "progressStageMastered";

export function progressStageClass(completedPercent: number): ProgressStage {
  if (completedPercent >= 100) return "progressStageMastered";
  if (completedPercent >= 75) return "progressStageViolet";
  if (completedPercent >= 50) return "progressStageEmerald";
  if (completedPercent >= 25) return "progressStageCyan";
  return "progressStageBlue";
}

export function unmodeledComponentsNote(
  components: readonly ComponentCreditProgress[],
  componentName: (id: ComponentId) => string | undefined = (id) =>
    componentsById.get(id)?.name,
): { credits: number; names: string[]; text: string } | undefined {
  const unmodeledComponents = components.filter(
    (component) =>
      component.groupings.length === 0 && component.requiredCredits > 0,
  );
  if (unmodeledComponents.length === 0) return undefined;

  const credits = unmodeledComponents.reduce(
    (total, component) => total + component.requiredCredits,
    0,
  );
  const names = unmodeledComponents.map(
    (component) => componentName(component.componentId) ?? "el componente indicado",
  );
  const namesText =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

  return {
    credits,
    names,
    text: `${credits} créditos de ${namesText} aún no están modelados en Sidera.`,
  };
}

export function progressBarPresentation({
  completedCredits,
  requiredCredits,
  completedRatio,
  inProgressCredits,
}: {
  completedCredits: number;
  requiredCredits: number;
  completedRatio: number;
  inProgressCredits: number;
}): ProgressBarPresentation {
  const cappedCompletedRatio = Math.min(Math.max(completedRatio, 0), 1);
  const inProgressRatio = Math.min(
    inProgressCredits / requiredCredits,
    1 - cappedCompletedRatio,
  );
  const completedPercent = Math.round(cappedCompletedRatio * 100);
  const inProgressText =
    inProgressCredits > 0
      ? `+${inProgressCredits} créditos en curso`
      : undefined;

  return {
    completedPercent,
    completedRatio: cappedCompletedRatio,
    inProgressRatio,
    completedText: `${completedCredits} / ${requiredCredits} créditos · ${completedPercent}%`,
    inProgressText,
    ariaLabel: `${completedCredits} de ${requiredCredits} créditos completados, ${completedPercent}%${inProgressCredits > 0 ? `, más ${inProgressCredits} créditos en curso` : ""}`,
  };
}

const provenanceLabels: Record<Provenance, string> = {
  official: "Oficial",
  proposal: "Propuesta",
  community: "Comunitaria",
};

const lifecycleLabels: Record<Lifecycle, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

export function planVersionStatus(
  provenance: Provenance,
  lifecycle: Lifecycle,
): string {
  return `Procedencia: ${provenanceLabels[provenance]} · Estado: ${lifecycleLabels[lifecycle]}`;
}

export function courseReference(versionCourseId: VersionCourseId): string {
  const versionCourse = versionCoursesById.get(versionCourseId);
  const course = versionCourse && coursesById.get(versionCourse.courseId);
  return versionCourse && course
    ? `${versionCourse.academicCode} ${course.name}`
    : "Materia no encontrada";
}

function blockingReason(evaluation: RequirementEvaluationNode): string | undefined {
  if (evaluation.diagnostics.length > 0) return undefined;

  switch (evaluation.type) {
    case "COURSE_COMPLETED":
      return `Te falta aprobar ${courseReference(evaluation.versionCourseId)}`;
    case "COURSE_COMPLETED_OR_CONCURRENT":
      return `Te falta cursar (o aprobar) ${courseReference(evaluation.versionCourseId)}`;
    case "MIN_TOTAL_CREDITS":
      return `${evaluation.actual}/${evaluation.required} créditos aprobados en el plan, te faltan ${Math.max(evaluation.required - evaluation.actual, 0)}`;
    case "MIN_COMPONENT_CREDITS": {
      const component = evaluation.componentId
        ? componentsById.get(evaluation.componentId)
        : undefined;
      return `${evaluation.actual}/${evaluation.required} créditos aprobados en ${component?.name ?? "el componente indicado"}, te faltan ${Math.max(evaluation.required - evaluation.actual, 0)}`;
    }
    case "MIN_GROUPING_CREDITS": {
      const grouping = evaluation.groupingId
        ? groupingsById.get(evaluation.groupingId)
        : undefined;
      return `${evaluation.actual}/${evaluation.required} créditos aprobados en ${grouping?.name ?? "la agrupación indicada"}, te faltan ${Math.max(evaluation.required - evaluation.actual, 0)}`;
    }
    case "MIN_GROUPING_COURSES": {
      const grouping = groupingsById.get(evaluation.groupingId);
      return `${evaluation.actual}/${evaluation.required} materias aprobadas en ${grouping?.name ?? "la agrupación indicada"}, te faltan ${Math.max(evaluation.required - evaluation.actual, 0)}`;
    }
    case "ANY":
    case "AT_LEAST": {
      const alternatives = evaluation.children
        .filter((child) => !child.satisfied)
        .map(blockingReason)
        .filter((reason): reason is string => reason !== undefined);
      return alternatives.length > 0
        ? `Te falta satisfacer alguna de estas alternativas: ${alternatives.join("; ")}`
        : undefined;
    }
    case "ALL": {
      const reasons = evaluation.children
        .filter((child) => !child.satisfied)
        .map(blockingReason)
        .filter((reason): reason is string => reason !== undefined);
      return reasons.length > 0 ? reasons.join("; ") : undefined;
    }
  }
}

export function blockingReasons(
  evaluation: RequirementEvaluationNode,
): string[] {
  return collectBlockingEvaluations(evaluation)
    .map(blockingReason)
    .filter((reason): reason is string => reason !== undefined);
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
