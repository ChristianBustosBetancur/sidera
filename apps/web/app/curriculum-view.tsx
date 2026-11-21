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
  evaluateVersionCourseEligibility,
  type GroupingCreditProgress,
  type StudentTrajectory,
} from "@sidera/curriculum-engine";
import { programs, type AcademicProgramData } from "../lib/programs";
import { useMemo, useState } from "react";
import {
  courseStateCounts,
  type CourseStateCounts,
  type PlanProgressProjection,
  planVersionStatus,
  planProgressProjection,
  progressBarPresentation,
  progressStageClass,
  satisfiedProgressBarArguments,
} from "../lib/curriculum-data";
import { type Mark, useTrajectory } from "../lib/trajectory";
import { requirementShortfall } from "../lib/sync-notice";
import { isSimulatedProgram, marksAreAvailable } from "../lib/dual-roles";
import { electiveSurplus, electivesFullNote, surplusNote } from "../lib/elective-surplus";
import styles from "./curriculum-view.module.css";
import { useDisplayMode } from "../lib/display-mode";

function createCurriculumView(data: AcademicProgramData) {
const { snapshot, coursesById, courseReference, blockingReasons, requirementLines, unmodeledComponentsNote } = data;
const groupingsByComponentId = new Map(
  snapshot.components.map((component) => [
    component.id,
    snapshot.groupings.filter(
      (grouping) => grouping.componentId === component.id,
    ),
  ]),
);
const versionCoursesByGroupingId = new Map(
  snapshot.groupings.map((grouping) => [
    grouping.id,
    snapshot.versionCourses.filter(
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
        {/* Permanecen montados para interpolar también desde/hasta cero. Un
            segmento vacío no ocupa ancho ni conserva un resplandor visible. */}
        <span
          className={styles.progressCompleted}
          data-empty={presentation.completedRatio === 0}
          aria-hidden="true"
          style={{ width: `${presentation.completedRatio * 100}%` }}
        />
        <span
          className={styles.progressInProgress}
          aria-hidden="true"
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
  surplus,
  onMark,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  trajectory: StudentTrajectory;
  /** Optativa marcada que no cabe en el cupo de su agrupación. */
  surplus: boolean;
  onMark: (mark: Mark) => void;
}) {
  const { evaluationContext, records, program } = useTrajectory();
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
  /* En un plan simulado la matrícula es real en la carrera de origen: aquí no
     se retira, se advierte. El aviso vive en la tarjeta para que se vea al
     consultar la asignatura, no solo al momento de marcarla. */
  const simulated = isSimulatedProgram(records, program.id);
  const preservedEligibility =
    simulated && currentMark !== "UNMARKED"
      ? evaluateVersionCourseEligibility(versionCourse.id, evaluationContext, trajectory)
      : undefined;
  const preservedShortfall =
    preservedEligibility && !preservedEligibility.satisfied &&
    preservedEligibility.requirementEvaluation
      ? requirementShortfall(blockingReasons(preservedEligibility.requirementEvaluation))
      : undefined;
  /* Un hecho compartido se decide en la carrera de origen, así que su tarjeta
     nunca queda sin acciones: aunque este plan lo considere bloqueado, el
     estudiante tiene que poder corregirlo desde cualquiera de los dos. */
  const marksAvailable = marksAreAvailable(records, versionCourse.courseId, blocked);

  return (
    <article data-grouping={versionCourse.groupingId} className={`${styles.courseCard} ${styles[state.toLowerCase()]}`}>
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
        {/* No cabe en el cupo optativo de su agrupación: sigue cursada y
            aprobada, pero no suma en esta barra. */}
        {surplus ? (
          <span className={styles.surplusBadge} title="No cabe en el cupo de optativas de esta agrupación, así que no suma en su barra.">
            Excedente
          </span>
        ) : null}
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

      {preservedShortfall ? (
        <p className={styles.simulatedWarning} role="note">
          {preservedShortfall} · Se mantiene {currentMark === "IN_PROGRESS" ? "«En curso»" : "«Completada»"} porque {program.label} es un plan simulado.
        </p>
      ) : null}

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
          disabled={!marksAvailable}
          onClick={() => onMark("IN_PROGRESS")}
        >
          En curso
        </button>
        <button
          type="button"
          className={currentMark === "COMPLETED" ? styles.selectedAction : undefined}
          aria-pressed={currentMark === "COMPLETED"}
          disabled={!marksAvailable}
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
  /* El excedente es una lectura del mismo reparto que ya hizo el motor: deja
     ver qué optativa quedó fuera del cupo y por qué la barra no se mueve. */
  const surplus = useMemo(
    () =>
      electiveSurplus({
        courses: versionCourses,
        requiredCredits: grouping.requiredCredits,
        completed: new Set(trajectory.completedVersionCourseIds),
        inProgress: new Set(trajectory.inProgressVersionCourseIds),
      }),
    [versionCourses, grouping.requiredCredits, trajectory],
  );
  const surplusCourses = useMemo(() => new Set(surplus.surplus), [surplus]);
  const fullNote = electivesFullNote(surplus, courseReference);
  const excess = surplusNote(surplus);

  return (
    <section data-grouping={grouping.id} className={styles.grouping} aria-labelledby={`grouping-${grouping.id}`}>
      <div className={styles.groupingHeading}>
        <h3 id={`grouping-${grouping.id}`}>{grouping.name}</h3>
        <span>{grouping.requiredCredits} créditos requeridos</span>
      </div>
      <ProgressBar
        {...satisfiedProgressBarArguments(progress, progress.requiredCredits)}
      />
      {excess || fullNote ? (
        <p className={styles.groupingSurplus}>
          {[excess, fullNote].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className={styles.courseGrid}>
        {versionCourses.map((versionCourse) => (
          <CourseCard
            key={versionCourse.id}
            versionCourse={versionCourse}
            state={states.get(versionCourse.id) ?? "BLOCKED"}
            trajectory={trajectory}
            surplus={surplusCourses.has(versionCourse.id)}
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
    <section data-component={component.id} className={styles.component} aria-labelledby={`component-${component.id}`}>
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

function ProgramCurriculumView() {
  const { fullView, planScale } = useDisplayMode();
  const { trajectory, states, markCourse, evaluationContext } = useTrajectory();

  const progress = useMemo(
    () =>
      calculateSatisfiedPlanProgress(
        evaluationContext,
        trajectory,
        snapshot.planVersion.requiredCredits,
      ),
    [trajectory, evaluationContext],
  );
  const unmodeledNote = unmodeledComponentsNote(progress.components);
  const projection = planProgressProjection({
    satisfiedCredits: progress.satisfiedCredits,
    projectedSatisfiedCredits: progress.projectedSatisfiedCredits,
    requiredCredits: progress.requiredCredits,
  });
  const counts = courseStateCounts(states);

  return (
    <main data-program={data.id} className={styles.page} data-full-view={fullView} style={fullView ? { zoom: planScale } : undefined}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{snapshot.university.name}</p>
          <h1>{snapshot.academicProgram.name}</h1>
          <p className={styles.planName}>
            {snapshot.planVersion.name} ·{" "}
            {planVersionStatus(
              snapshot.planVersion.provenance,
              snapshot.planVersion.lifecycle,
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
            {snapshot.versionCourses.length} materias incluidas en el
            dataset curado
          </p>
        </div>
      </div>

      <div className={styles.curriculumTree}>
        {snapshot.components.map((component) => (
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

return ProgramCurriculumView;
}

const views = new Map(programs.map(program => [program.id, createCurriculumView(program)]));
export function CurriculumView() {
  const { program } = useTrajectory();
  const View = views.get(program.id)!;
  return <View />;
}
