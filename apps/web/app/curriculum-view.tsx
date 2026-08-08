"use client";

import type {
  Component,
  Grouping,
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  calculatePlanProgress,
  deriveVersionCourseState,
  type CurriculumEvaluationContext,
  type DerivedCourseState,
  type StudentTrajectory,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { useMemo, useState } from "react";
import styles from "./curriculum-view.module.css";

type Mark = "UNMARKED" | "IN_PROGRESS" | "COMPLETED";

const EMPTY_TRAJECTORY: StudentTrajectory = {
  completedVersionCourseIds: [],
  inProgressVersionCourseIds: [],
};

const evaluationContext: CurriculumEvaluationContext = {
  planVersionId: unalCs2024Official.planVersion.id,
  versionCourses: unalCs2024Official.versionCourses,
  groupings: unalCs2024Official.groupings,
  components: unalCs2024Official.components,
};

const coursesById = new Map(
  unalCs2024Official.courses.map((course) => [course.id, course]),
);
const versionCoursesById = new Map(
  unalCs2024Official.versionCourses.map((versionCourse) => [
    versionCourse.id,
    versionCourse,
  ]),
);
const componentsById = new Map(
  unalCs2024Official.components.map((component) => [component.id, component]),
);
const groupingsById = new Map(
  unalCs2024Official.groupings.map((grouping) => [grouping.id, grouping]),
);
const groupingsByComponentId = new Map(
  unalCs2024Official.components.map((component) => [
    component.id,
    unalCs2024Official.groupings.filter(
      (grouping) => grouping.componentId === component.id,
    ),
  ]),
);
const versionCoursesByGroupingId = new Map(
  unalCs2024Official.groupings.map((grouping) => [
    grouping.id,
    unalCs2024Official.versionCourses.filter(
      (versionCourse) => versionCourse.groupingId === grouping.id,
    ),
  ]),
);

const stateLabels: Record<DerivedCourseState, string> = {
  AVAILABLE: "Disponible",
  BLOCKED: "Bloqueada",
  COMPLETED: "Completada",
  IN_PROGRESS: "En curso",
};

function courseReference(versionCourseId: VersionCourseId): string {
  const versionCourse = versionCoursesById.get(versionCourseId);
  const course = versionCourse && coursesById.get(versionCourse.courseId);
  return versionCourse && course
    ? `${versionCourse.academicCode} ${course.name}`
    : "Materia no encontrada";
}

function requirementLines(requirement: RequirementExpression): string[] {
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

function CourseCard({
  versionCourse,
  state,
  onMark,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  onMark: (mark: Mark) => void;
}) {
  const course = coursesById.get(versionCourse.courseId);
  const requirementText = versionCourse.requirements
    ? requirementLines(versionCourse.requirements)
    : [];
  const currentMark: Mark =
    state === "COMPLETED" || state === "IN_PROGRESS" ? state : "UNMARKED";
  const blocked = state === "BLOCKED";

  return (
    <article className={`${styles.courseCard} ${styles[state.toLowerCase()]}`}>
      <div className={styles.courseTopline}>
        <span className={styles.code}>{versionCourse.academicCode}</span>
        <span
          className={`${styles.kindBadge} ${versionCourse.mandatory ? styles.mandatory : styles.elective}`}
        >
          {versionCourse.mandatory ? "Obligatoria" : "Electiva"}
        </span>
      </div>
      <h4>{course?.name ?? "Materia sin nombre"}</h4>
      <div className={styles.courseFacts}>
        <span>{versionCourse.credits} créditos</span>
        <span className={styles.stateBadge} data-state={state}>
          {stateLabels[state]}
        </span>
      </div>

      {requirementText.length > 0 ? (
        <ul className={styles.requirements}>
          {requirementText.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.noRequirements}>Sin prerrequisitos ni correquisitos.</p>
      )}

      <div
        className={styles.actions}
        role="group"
        aria-label={`Trayectoria para ${course?.name ?? versionCourse.academicCode}`}
      >
        <button
          type="button"
          className={currentMark === "UNMARKED" ? styles.selectedAction : undefined}
          aria-pressed={currentMark === "UNMARKED"}
          onClick={() => onMark("UNMARKED")}
        >
          Sin marcar
        </button>
        <button
          type="button"
          className={currentMark === "IN_PROGRESS" ? styles.selectedAction : undefined}
          aria-pressed={currentMark === "IN_PROGRESS"}
          disabled={blocked}
          onClick={() => onMark("IN_PROGRESS")}
        >
          En curso
        </button>
        <button
          type="button"
          className={currentMark === "COMPLETED" ? styles.selectedAction : undefined}
          aria-pressed={currentMark === "COMPLETED"}
          disabled={blocked}
          onClick={() => onMark("COMPLETED")}
        >
          Completada
        </button>
      </div>
    </article>
  );
}

function GroupingSection({
  grouping,
  versionCourses,
  states,
  onMark,
}: {
  grouping: Grouping;
  versionCourses: readonly VersionCourse[];
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  onMark: (versionCourseId: VersionCourseId, mark: Mark) => void;
}) {
  return (
    <section className={styles.grouping} aria-labelledby={`grouping-${grouping.id}`}>
      <div className={styles.groupingHeading}>
        <h3 id={`grouping-${grouping.id}`}>{grouping.name}</h3>
        <span>{grouping.requiredCredits} créditos requeridos</span>
      </div>
      <div className={styles.courseGrid}>
        {versionCourses.map((versionCourse) => (
          <CourseCard
            key={versionCourse.id}
            versionCourse={versionCourse}
            state={states.get(versionCourse.id) ?? "BLOCKED"}
            onMark={(mark) => onMark(versionCourse.id, mark)}
          />
        ))}
      </div>
    </section>
  );
}

function ComponentSection({
  component,
  states,
  onMark,
}: {
  component: Component;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  onMark: (versionCourseId: VersionCourseId, mark: Mark) => void;
}) {
  const componentGroupings = groupingsByComponentId.get(component.id) ?? [];

  return (
    <section className={styles.component} aria-labelledby={`component-${component.id}`}>
      <div className={styles.componentHeading}>
        <p>Componente</p>
        <h2 id={`component-${component.id}`}>{component.name}</h2>
        <span>{component.requiredCredits} créditos requeridos</span>
      </div>
      {componentGroupings.length > 0 ? (
        componentGroupings.map((grouping) => (
          <GroupingSection
            key={grouping.id}
            grouping={grouping}
            versionCourses={versionCoursesByGroupingId.get(grouping.id) ?? []}
            states={states}
            onMark={onMark}
          />
        ))
      ) : (
        <p className={styles.emptyGrouping}>Este componente no contiene agrupaciones de materias en el dataset.</p>
      )}
    </section>
  );
}

export function CurriculumView() {
  const [trajectory, setTrajectory] = useState<StudentTrajectory>(EMPTY_TRAJECTORY);

  const states = useMemo(() => {
    return new Map(
      unalCs2024Official.versionCourses.map((versionCourse) => [
        versionCourse.id,
        deriveVersionCourseState(versionCourse.id, evaluationContext, trajectory).state,
      ]),
    );
  }, [trajectory]);

  const progress = useMemo(
    () =>
      calculatePlanProgress(
        evaluationContext,
        trajectory,
        unalCs2024Official.planVersion.requiredCredits,
      ),
    [trajectory],
  );

  function markCourse(versionCourseId: VersionCourseId, mark: Mark) {
    setTrajectory((current) => ({
      completedVersionCourseIds:
        mark === "COMPLETED"
          ? [...current.completedVersionCourseIds.filter((id) => id !== versionCourseId), versionCourseId]
          : current.completedVersionCourseIds.filter((id) => id !== versionCourseId),
      inProgressVersionCourseIds:
        mark === "IN_PROGRESS"
          ? [...current.inProgressVersionCourseIds.filter((id) => id !== versionCourseId), versionCourseId]
          : current.inProgressVersionCourseIds.filter((id) => id !== versionCourseId),
    }));
  }

  const progressPercent = Math.round(progress.ratio * 100);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{unalCs2024Official.university.name}</p>
          <h1>{unalCs2024Official.academicProgram.name}</h1>
          <p className={styles.planName}>{unalCs2024Official.planVersion.name} · Plan oficial</p>
        </div>
        <section className={styles.progressCard} aria-labelledby="progress-title">
          <p id="progress-title">Progreso académico</p>
          <strong>
            {progress.completedCredits} / {progress.requiredCredits} créditos
          </strong>
          <progress value={progress.ratio} max={1} aria-label={`${progressPercent}% completado`} />
          <span>{progressPercent}% completado · ratio {progress.ratio.toFixed(2)}</span>
        </section>
      </header>

      <div className={styles.intro}>
        <p>
          Explora el plan por componente y agrupación. Marca las materias disponibles para ver cómo cambia tu trayectoria.
        </p>
        <p>{unalCs2024Official.versionCourses.length} materias en el plan</p>
      </div>

      <div className={styles.curriculumTree}>
        {unalCs2024Official.components.map((component) => (
          <ComponentSection
            key={component.id}
            component={component}
            states={states}
            onMark={markCourse}
          />
        ))}
      </div>
    </main>
  );
}
