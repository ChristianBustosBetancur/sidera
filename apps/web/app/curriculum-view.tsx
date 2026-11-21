"use client";

import type {
  Component,
  Grouping,
  GroupingId,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  calculateFreeChoiceProgress,
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
import { electivesFullNote, freeChoiceOrigins, groupingElectiveStates, originNote, surplusNote, type GroupingElectiveState } from "../lib/elective-surplus";
import { planProgressWithFreeChoice } from "../lib/plan-progress";
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
  onMark,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  trajectory: StudentTrajectory;
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
  surplus,
  onMark,
}: {
  grouping: Grouping;
  versionCourses: readonly VersionCourse[];
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  trajectory: StudentTrajectory;
  progress: GroupingCreditProgress;
  surplus: GroupingElectiveState | undefined;
  onMark: (versionCourseId: VersionCourseId, mark: Mark) => void;
}) {
  /* El excedente se cuenta en créditos y no señala ninguna asignatura: con dos
     optativas aprobadas compitiendo por un cupo, cuál «sobra» dependería del
     orden interno del motor, que no es una afirmación académica. */
  const fullNote = surplus ? electivesFullNote(surplus, courseReference) : undefined;
  const excess = surplus ? surplusNote(surplus) : undefined;

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
  electiveStates,
  onMark,
}: {
  component: Component;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  trajectory: StudentTrajectory;
  progress: ComponentCreditProgress;
  electiveStates: ReadonlyMap<GroupingId, GroupingElectiveState>;
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
              surplus={electiveStates.get(grouping.id)}
              onMark={onMark}
            />
          ))}
        </>
      ) : (
        <FreeChoiceSection component={component} trajectory={trajectory} />
      )}
      </div>
    </section>
  );
}

/* Libre Elección no tiene materias modeladas, pero sí recibe los créditos
   optativos que otras agrupaciones no pueden reconocer. La barra muestra esa
   estimación, no un reconocimiento confirmado por la Universidad: mientras no
   se verifique la norma aplicable, el rótulo y la nota lo dicen. */
function FreeChoiceSection({ component, trajectory }: { component: Component; trajectory: StudentTrajectory }) {
  const { evaluationContext, records, program } = useTrajectory();
  /* Acuerdo 155 de 2014: en Doble Titulación los créditos pendientes por
     componente y agrupación del segundo programa los determina su comité
     asesor. Esta estimación no los sustituye ni los anticipa. */
  const simulated = isSimulatedProgram(records, program.id);
  const freeChoice = useMemo(
    () => calculateFreeChoiceProgress(evaluationContext, trajectory, component.requiredCredits),
    [evaluationContext, trajectory, component.requiredCredits],
  );
  const origins = useMemo(() => freeChoiceOrigins(evaluationContext, trajectory), [evaluationContext, trajectory]);
  const groupingName = (id: GroupingId) => snapshot.groupings.find(grouping => grouping.id === id)?.name ?? "otra agrupación";

  return (
    <div className={styles.freeChoice}>
      {/* La salvedad normativa completa vive en la documentación técnica; aquí
          basta una etiqueta discreta para no repetir advertencias largas. */}
      <p className={styles.freeChoiceBadgeRow}>
        <span className={styles.estimatedBadge}>Estimado</span>
      </p>
      <ProgressBar
        completedCredits={freeChoice.estimatedCredits}
        requiredCredits={freeChoice.requiredCredits}
        completedRatio={freeChoice.requiredCredits > 0 ? freeChoice.estimatedCredits / freeChoice.requiredCredits : 0}
        inProgressCredits={freeChoice.projectedCredits - freeChoice.estimatedCredits}
      />
      <p className={styles.freeChoiceNote}>
        Los créditos que exceden los requisitos de otras agrupaciones se contabilizan aquí de forma estimada.
        {simulated ? " En un plan simulado, los créditos del segundo programa los determina su comité asesor." : ""}
      </p>
      {origins.length > 0 ? (
        /* Se nombra la agrupación de origen y cuántas optativas hay detrás,
           nunca una asignatura concreta: con el cupo disputado, señalar a una
           sería una afirmación que no podemos sostener. */
        <ul className={styles.freeChoiceBreakdown}>
          {origins.map((origin) => (
            <li key={origin.groupingId}>
              <strong>{groupingName(origin.groupingId)}</strong>
              <span>{originNote(origin)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.unavailableProgressExplanation}>
          Todavía no hay créditos optativos por encima del cupo de ninguna agrupación.
        </p>
      )}
      {freeChoice.uncountedCredits > 0 ? (
        <p className={styles.freeChoiceNote}>
          Hay {freeChoice.uncountedCredits} créditos excedentes por encima de los {freeChoice.requiredCredits} que
          exige el componente. No se pierden del expediente, pero ya no suman en esta barra.
        </p>
      ) : null}
    </div>
  );
}

function ProgramCurriculumView() {
  const { fullView, planScale } = useDisplayMode();
  const { trajectory, states, markCourse, evaluationContext } = useTrajectory();

  /* El total del plan incluye la estimación de Libre Elección: los 140 y 146
     créditos exigidos ya la contaban, y el excedente que la alimenta nunca
     estuvo en `satisfiedCredits`, así que no se duplica ningún crédito. */
  const plan = useMemo(
    () => planProgressWithFreeChoice(evaluationContext, trajectory, snapshot),
    [trajectory, evaluationContext],
  );
  const progress = plan.progress;
  // Un solo reparto para todas las agrupaciones del plan, en lugar de que cada
  // sección lo recalcule por su cuenta.
  const electiveStates = useMemo(
    () => groupingElectiveStates(evaluationContext, trajectory),
    [evaluationContext, trajectory],
  );
  const unmodeledNote = unmodeledComponentsNote(progress.components);
  const projection = planProgressProjection({
    satisfiedCredits: plan.satisfiedCredits,
    projectedSatisfiedCredits: plan.projectedSatisfiedCredits,
    requiredCredits: plan.requiredCredits,
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
            completedCredits={plan.satisfiedCredits}
            requiredCredits={plan.requiredCredits}
            completedRatio={plan.requiredCredits > 0 ? plan.satisfiedCredits / plan.requiredCredits : 0}
            inProgressCredits={plan.projectedSatisfiedCredits - plan.satisfiedCredits}
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
            electiveStates={electiveStates}
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
