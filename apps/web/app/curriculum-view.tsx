"use client";

import type {
  Component,
  Grouping,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  calculateSatisfiedPlanProgress,
  type ComponentCreditProgress,
  deriveVersionCourseState,
  type DerivedCourseState,
  type GroupingCreditProgress,
  type StudentTrajectory,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { useMemo, useState } from "react";
import {
  blockingReasons,
  courseStateCounts,
  coursesById,
  evaluationContext,
  type CourseStateCounts,
  type PlanProgressProjection,
  planVersionStatus,
  planProgressProjection,
  progressBarPresentation,
  progressStageClass,
  requirementLines,
  satisfiedProgressBarArguments,
  unmodeledComponentsNote,
} from "../lib/curriculum-data";
import { type Mark, useTrajectory } from "../lib/trajectory";
import styles from "./curriculum-view.module.css";

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

function ProgressBar({
  completedCredits,
  requiredCredits,
  completedRatio,
  inProgressCredits,
  projection,
  counts,
}: {
  completedCredits: number;
  requiredCredits: number;
  completedRatio: number;
  inProgressCredits: number;
  projection?: PlanProgressProjection;
  counts?: CourseStateCounts;
}) {
  const presentation = progressBarPresentation({
    completedCredits,
    requiredCredits,
    completedRatio,
    inProgressCredits,
  });
  const stageClass = styles[progressStageClass(presentation.completedPercent)];

  return (
    <div className={styles.progressBar}>
      <div className={styles.progressText}>
        <strong>{presentation.completedText}</strong>
        {presentation.inProgressText ? (
          <span>{presentation.inProgressText}</span>
        ) : null}
      </div>
      <div
        className={`${styles.progressTrack} ${stageClass}`}
        role="img"
        aria-label={
          projection
            ? `${presentation.ariaLabel}. ${projection.ariaLabel}`
            : presentation.ariaLabel
        }
      >
        <span
          className={styles.progressCompleted}
          style={{ width: `${presentation.completedRatio * 100}%` }}
        />
        <span
          className={styles.progressInProgress}
          style={{ width: `${presentation.inProgressRatio * 100}%` }}
        />
        {projection ? (
          <span
            className={styles.progressProjectionMarker}
            style={{ left: `${projection.markerRatio * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {projection ? (
        <p className={styles.progressProjection}>{projection.text}</p>
      ) : null}
      {counts ? <p className={styles.progressCounts}>{counts.text}</p> : null}
    </div>
  );
}

function CourseCard({
  versionCourse,
  state,
  trajectory,
  onMark,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  trajectory: StudentTrajectory;
  onMark: (mark: Mark) => void;
}) {
  const course = coursesById.get(versionCourse.courseId);
  const requirementText = versionCourse.requirements
    ? requirementLines(versionCourse.requirements)
    : [];
  const currentMark: Mark =
    state === "COMPLETED" || state === "IN_PROGRESS" ? state : "UNMARKED";
  const blocked = state === "BLOCKED";
  const derivedState = blocked
    ? deriveVersionCourseState(versionCourse.id, evaluationContext, trajectory)
    : undefined;
  const blockedReasonText =
    derivedState?.state === "BLOCKED" &&
    derivedState.eligibility.requirementEvaluation
      ? blockingReasons(derivedState.eligibility.requirementEvaluation)
      : [];

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

      {blocked ? (
        <section className={styles.blockingReasons}>
          <h5>Por qué está bloqueada</h5>
          {blockedReasonText.length > 0 ? (
            <ul>
              {blockedReasonText.map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>No cumple los requisitos actuales del plan</p>
          )}
        </section>
      ) : null}

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
  trajectory,
  progress,
  onMark,
}: {
  grouping: Grouping;
  versionCourses: readonly VersionCourse[];
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  trajectory: StudentTrajectory;
  progress: GroupingCreditProgress;
  onMark: (versionCourseId: VersionCourseId, mark: Mark) => void;
}) {
  return (
    <section className={styles.grouping} aria-labelledby={`grouping-${grouping.id}`}>
      <div className={styles.groupingHeading}>
        <h3 id={`grouping-${grouping.id}`}>{grouping.name}</h3>
        <span>{grouping.requiredCredits} créditos requeridos</span>
      </div>
      <ProgressBar
        {...satisfiedProgressBarArguments(progress, progress.requiredCredits)}
      />
      <div className={styles.courseGrid}>
        {versionCourses.map((versionCourse) => (
          <CourseCard
            key={versionCourse.id}
            versionCourse={versionCourse}
            state={states.get(versionCourse.id) ?? "BLOCKED"}
            trajectory={trajectory}
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
  trajectory,
  progress,
  onMark,
}: {
  component: Component;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  trajectory: StudentTrajectory;
  progress: ComponentCreditProgress;
  onMark: (versionCourseId: VersionCourseId, mark: Mark) => void;
}) {
  const componentGroupings = groupingsByComponentId.get(component.id) ?? [];
  /* Estado de sesión, no persistido: abrir todo al entrar mantiene el plan
     legible de un vistazo y evita que el usuario tenga que recordar en qué
     estado lo dejó. */
  const [expanded, setExpanded] = useState(true);
  const contentId = `component-content-${component.id}`;

  return (
    <section className={styles.component} aria-labelledby={`component-${component.id}`}>
      {/* El encabezado ENTERO es el control: un objetivo amplio y predecible.
          Como es un `<button>` real, el teclado y los lectores de pantalla
          funcionan sin añadir manejadores propios. */}
      <button
        type="button"
        className={styles.componentHeading}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <h2 id={`component-${component.id}`}>{component.name}</h2>
        <span className={styles.componentCredits}>
          {component.requiredCredits} créditos requeridos
        </span>
        <svg
          className={styles.componentChevron}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5.5 8 10 12.5 14.5 8" />
        </svg>
      </button>
      {/* `hidden` NO desmonta: los hijos siguen montados en React y presentes
          en el DOM, y es el navegador quien los oculta. Se prefiere así porque
          conserva el estado interno de las tarjetas y evita medir alturas para
          animar; el coste es que el contenido plegado se sigue renderizando. */}
      <div id={contentId} hidden={!expanded}>
      {componentGroupings.length > 0 ? (
        <>
          <ProgressBar
            {...satisfiedProgressBarArguments(progress, progress.requiredCredits)}
          />
          {componentGroupings.map((grouping) => (
            <GroupingSection
              key={grouping.id}
              grouping={grouping}
              versionCourses={versionCoursesByGroupingId.get(grouping.id) ?? []}
              states={states}
              trajectory={trajectory}
              progress={progress.groupings.find(
                (groupingProgress) =>
                  groupingProgress.groupingId === grouping.id,
              )!}
              onMark={onMark}
            />
          ))}
        </>
      ) : (
        <div className={styles.unavailableProgress}>
          <div
            className={styles.unavailableProgressTrack}
            role="img"
            aria-label="Progreso no disponible: sin materias modeladas en Sidera"
          />
          <span className={styles.unavailableProgressBadge}>
            Aún no modelado en Sidera
          </span>
          <p className={styles.unavailableProgressExplanation}>
            Sidera todavía no tiene materias modeladas para este componente, por lo que su
            progreso no puede calcularse.
          </p>
        </div>
      )}
      </div>
    </section>
  );
}

export function CurriculumView() {
  const { trajectory, states, markCourse } = useTrajectory();

  const progress = useMemo(
    () =>
      calculateSatisfiedPlanProgress(
        evaluationContext,
        trajectory,
        unalCs2024Official.planVersion.requiredCredits,
      ),
    [trajectory],
  );
  const unmodeledNote = unmodeledComponentsNote(progress.components);
  const projection = planProgressProjection({
    satisfiedCredits: progress.satisfiedCredits,
    projectedSatisfiedCredits: progress.projectedSatisfiedCredits,
    requiredCredits: progress.requiredCredits,
  });
  const counts = courseStateCounts(states);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{unalCs2024Official.university.name}</p>
          <h1>{unalCs2024Official.academicProgram.name}</h1>
          <p className={styles.planName}>
            {unalCs2024Official.planVersion.name} ·{" "}
            {planVersionStatus(
              unalCs2024Official.planVersion.provenance,
              unalCs2024Official.planVersion.lifecycle,
            )}
          </p>
        </div>
        <section className={styles.progressCard} aria-labelledby="progress-title">
          <p id="progress-title">Progreso académico</p>
          <ProgressBar
            {...satisfiedProgressBarArguments(progress, progress.requiredCredits)}
            projection={projection}
            counts={counts}
          />
          {unmodeledNote ? (
            <p className={styles.unmodeledCreditsNote}>
              {unmodeledNote.text}
            </p>
          ) : null}
        </section>
      </header>

      <div className={styles.intro}>
        <p>
          Explora el plan por componente y agrupación. Marca las materias disponibles para ver cómo cambia tu trayectoria.
        </p>
        <div>
          <p>
            Visualiza prerrequisitos, correquisitos y rutas entre materias
          </p>
          <p className={styles.introMeta}>
            {unalCs2024Official.versionCourses.length} materias incluidas en el
            dataset curado
          </p>
        </div>
      </div>

      <div className={styles.curriculumTree}>
        {unalCs2024Official.components.map((component) => (
          <ComponentSection
            key={component.id}
            component={component}
            states={states}
            trajectory={trajectory}
            progress={progress.components.find(
              (componentProgress) =>
                componentProgress.componentId === component.id,
            )!}
            onMark={markCourse}
          />
        ))}
      </div>
    </main>
  );
}
