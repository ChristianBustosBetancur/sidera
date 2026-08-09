"use client";

import type {
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  type DerivedCourseState,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import Link from "next/link";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  coursesById,
  planVersionStatus,
  requirementLines,
  versionCoursesById,
} from "../lib/curriculum-data";
import {
  buildCurriculumGraph,
  type CourseEdge,
} from "../lib/curriculum-graph";
import { type Mark, useTrajectory } from "../lib/trajectory";
import styles from "./graph-view.module.css";

type Point = { x: number; y: number };
type EdgePosition = CourseEdge & { start: Point; end: Point };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
};

const DRAG_THRESHOLD = 5;

const graph = buildCurriculumGraph(unalCs2024Official.versionCourses);

const stateLabels: Record<DerivedCourseState, string> = {
  AVAILABLE: "Disponible",
  BLOCKED: "Bloqueada",
  COMPLETED: "Completada",
  IN_PROGRESS: "En curso",
};

function GraphCourseCard({
  versionCourse,
  state,
  selected,
  dimmed,
  setNodeRef,
  onSelect,
  onMark,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  selected: boolean;
  dimmed: boolean;
  setNodeRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onMark: (mark: Mark) => void;
}) {
  const course = coursesById.get(versionCourse.courseId);
  const requirements = versionCourse.requirements
    ? requirementLines(versionCourse.requirements)
    : [];
  const currentMark: Mark =
    state === "COMPLETED" || state === "IN_PROGRESS" ? state : "UNMARKED";

  return (
    <article
      ref={setNodeRef}
      className={`${styles.courseCard} ${styles[state.toLowerCase()]} ${selected ? styles.selected : ""} ${dimmed ? styles.dimmed : ""}`}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
    >
      <button
        type="button"
        className={styles.courseSelector}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        aria-label={`Enfocar relaciones de ${course?.name ?? versionCourse.academicCode}`}
      >
        <span className={styles.code}>{versionCourse.academicCode}</span>
        <strong>{course?.name ?? "Materia sin nombre"}</strong>
      </button>
      <div className={styles.facts}>
        <span>{versionCourse.credits} créditos</span>
        <span>{versionCourse.mandatory ? "Obligatoria" : "Electiva"}</span>
        <span className={styles.stateBadge} data-state={state}>
          {stateLabels[state]}
        </span>
      </div>
      {requirements.length > 0 ? (
        <ul className={styles.requirements}>
          {requirements.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div
        className={styles.actions}
        role="group"
        aria-label={`Trayectoria para ${course?.name ?? versionCourse.academicCode}`}
        onClick={(event) => event.stopPropagation()}
      >
        {(["UNMARKED", "IN_PROGRESS", "COMPLETED"] as const).map((mark) => (
          <button
            key={mark}
            type="button"
            aria-pressed={currentMark === mark}
            disabled={state === "BLOCKED" && mark !== "UNMARKED"}
            onClick={() => onMark(mark)}
          >
            {mark === "UNMARKED"
              ? "Sin marcar"
              : mark === "IN_PROGRESS"
                ? "En curso"
                : "Completada"}
          </button>
        ))}
      </div>
    </article>
  );
}

export function GraphView() {
  const { states, markCourse } = useTrajectory();
  const [selectedId, setSelectedId] = useState<VersionCourseId | null>(null);
  const [edgePositions, setEdgePositions] = useState<EdgePosition[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const graphRegionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<VersionCourseId, HTMLElement>());
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);

  const coursesByGraphLevel = useMemo(() => {
    const result = new Map<number, VersionCourse[]>();
    for (const versionCourse of unalCs2024Official.versionCourses) {
      const level = graph.graphLevels.get(versionCourse.id) ?? 0;
      result.set(level, [...(result.get(level) ?? []), versionCourse]);
    }
    return [...result.entries()].sort(([left], [right]) => left - right);
  }, []);

  const relatedIds = useMemo(() => {
    const ids = new Set<VersionCourseId>();
    if (!selectedId) return ids;
    ids.add(selectedId);
    for (const edge of graph.edges) {
      if (edge.sourceId === selectedId) ids.add(edge.targetId);
      if (edge.targetId === selectedId) ids.add(edge.sourceId);
    }
    return ids;
  }, [selectedId]);

  const measureEdges = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const positions = graph.edges.flatMap((edge): EdgePosition[] => {
      const source = nodeRefs.current.get(edge.sourceId);
      const target = nodeRefs.current.get(edge.targetId);
      if (!source || !target) return [];
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return [
        {
          ...edge,
          start: {
            x: sourceRect.right - canvasRect.left,
            y: sourceRect.top + sourceRect.height / 2 - canvasRect.top,
          },
          end: {
            x: targetRect.left - canvasRect.left,
            y: targetRect.top + targetRect.height / 2 - canvasRect.top,
          },
        },
      ];
    });
    setEdgePositions(positions);
  }, []);

  useLayoutEffect(() => {
    measureEdges();
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(measureEdges, 120);
    });
    observer.observe(canvas);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [measureEdges]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.pointerType === "touch" ||
      (event.pointerType !== "mouse" && event.pointerType !== "pen") ||
      event.button !== 0
    ) {
      return;
    }

    suppressNextClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      dragState.moved = true;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX;
    event.currentTarget.scrollTop = dragState.scrollTop - deltaY;
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLElement>,
    suppressClick: boolean,
  ) => {
    if (event.pointerType === "touch") return;

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    suppressNextClickRef.current = suppressClick && dragState.moved;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>{unalCs2024Official.university.name}</p>
          <h1>Grafo de prerrequisitos y correquisitos</h1>
          <span>
            {unalCs2024Official.planVersion.name} ·{" "}
            {planVersionStatus(
              unalCs2024Official.planVersion.provenance,
              unalCs2024Official.planVersion.lifecycle,
            )}
          </span>
          <span>
            {unalCs2024Official.versionCourses.length} materias incluidas en el
            dataset curado, organizadas por profundidad de sus relaciones
            directas.
          </span>
        </div>
        <Link href="/">Ver plan por componentes</Link>
      </header>

      <section className={styles.controls} aria-label="Leyenda e instrucciones">
        <div className={styles.legend}>
          <span><i className={styles.solidLine} /> Prerrequisito</span>
          <span><i className={styles.dashedLine} /> Correquisito</span>
        </div>
        <p>
          Selecciona una materia para destacar sus relaciones directas. Vuelve a
          seleccionarla para limpiar el foco.
        </p>
      </section>

      <div className={styles.graphNavigation}>
        <p className={styles.dragHint}>Arrastra para explorar el grafo.</p>
        <button
          type="button"
          onClick={() => {
            const graphRegion = graphRegionRef.current;
            if (!graphRegion) return;
            graphRegion.scrollLeft = 0;
            graphRegion.scrollTop = 0;
          }}
        >
          Volver al inicio
        </button>
      </div>

      {graph.cycles.length > 0 ? (
        <section className={styles.graphError} role="alert">
          <strong>Se detectaron relaciones cíclicas en los datos.</strong>
          {graph.cycles.map((cycle, index) => (
            <p key={index}>
              {cycle
                .map((id) => versionCoursesById.get(id)?.academicCode ?? id)
                .join(" → ")}
            </p>
          ))}
        </section>
      ) : null}

      <section
        ref={graphRegionRef}
        className={`${styles.graphRegion} ${isDragging ? styles.dragging : ""}`}
        aria-label="Grafo curricular"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={(event) => finishDrag(event, false)}
        onClickCapture={(event) => {
          if (!suppressNextClickRef.current) return;
          suppressNextClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div className={styles.canvas} ref={canvasRef}>
          <svg className={styles.edges} aria-hidden="true">
            {edgePositions.map((edge, index) => {
              const focused =
                selectedId === edge.sourceId || selectedId === edge.targetId;
              const middle = (edge.start.x + edge.end.x) / 2;
              return (
                <path
                  key={`${edge.sourceId}-${edge.targetId}-${edge.type}-${index}`}
                  d={`M ${edge.start.x} ${edge.start.y} C ${middle} ${edge.start.y}, ${middle} ${edge.end.y}, ${edge.end.x} ${edge.end.y}`}
                  className={`${edge.type === "COREQUISITE" ? styles.corequisiteEdge : styles.prerequisiteEdge} ${selectedId && !focused ? styles.edgeDimmed : ""} ${focused ? styles.edgeFocused : ""}`}
                />
              );
            })}
          </svg>

          <div className={styles.columns}>
            {coursesByGraphLevel.map(([level, versionCourses]) => (
              <section
                className={styles.levelColumn}
                key={level}
                aria-labelledby={`graph-level-${level}`}
              >
                <h2 id={`graph-level-${level}`}>Nivel del grafo {level}</h2>
                <p>{versionCourses.length} materias</p>
                <div className={styles.nodes}>
                  {versionCourses.map((versionCourse) => (
                    <GraphCourseCard
                      key={versionCourse.id}
                      versionCourse={versionCourse}
                      state={states.get(versionCourse.id) ?? "BLOCKED"}
                      selected={selectedId === versionCourse.id}
                      dimmed={selectedId !== null && !relatedIds.has(versionCourse.id)}
                      setNodeRef={(element) => {
                        if (element) nodeRefs.current.set(versionCourse.id, element);
                        else nodeRefs.current.delete(versionCourse.id);
                      }}
                      onSelect={() =>
                        setSelectedId((current) =>
                          current === versionCourse.id ? null : versionCourse.id,
                        )
                      }
                      onMark={(mark) => markCourse(versionCourse.id, mark)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
