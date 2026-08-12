"use client";

import type {
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  deriveVersionCourseState,
  type DerivedCourseState,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import Link from "next/link";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  blockingReasons,
  coursesById,
  evaluationContext,
  planVersionStatus,
  requirementLines,
  versionCoursesById,
} from "../lib/curriculum-data";
import {
  buildCurriculumGraph,
  type CourseEdge,
} from "../lib/curriculum-graph";
import {
  hasExceededDragThreshold,
  shouldSuppressClick,
} from "../lib/pointer-gestures";
import { type Mark, useTrajectory } from "../lib/trajectory";
import styles from "./graph-view.module.css";

type Point = { x: number; y: number };
type EdgePosition = CourseEdge & { start: Point; end: Point };
type DragState = {
  pointerId: number;
  captureTarget: Element;
  startX: number;
  startY: number;
  scrollLeft: number;
  startScrollY: number;
  moved: boolean;
};

const DRAG_THRESHOLD = 5;
/* Umbral literal del bloque `@media (min-width: 72.001rem)` de la hoja: el
   panel es arrastrable exactamente donde el CSS lo hace lateral flotante, y
   deja de serlo exactamente donde pasa a bottom sheet. Un solo breakpoint. */
const WIDE_DESKTOP_QUERY = "(min-width: 72.001rem)";
/* Margen mínimo entre el panel arrastrado y el borde del viewport. */
const PANEL_EDGE_MARGIN = 8;
/* Franja del panel que siempre queda dentro del viewport por abajo, para que
   su cabecera —y con ella el botón Cerrar— nunca sea inalcanzable. */
const PANEL_MIN_VISIBLE = 56;

type PanelOffset = { x: number; y: number };
type PanelBase = { left: number; top: number; right: number };

/* El offset es un delta sobre la posición que fija el CSS (`top`/`right` en
   clamp con vw), nunca una posición absoluta: así el panel conserva su anclaje
   responsive y basta con no aplicar el transform para que el bottom sheet de
   <=72rem quede intacto. */
function clampPanelOffset(offset: PanelOffset, base: PanelBase): PanelOffset {
  const minX = PANEL_EDGE_MARGIN - base.left;
  const maxX = window.innerWidth - PANEL_EDGE_MARGIN - base.right;
  const minY = PANEL_EDGE_MARGIN - base.top;
  const maxY =
    window.innerHeight - PANEL_EDGE_MARGIN - PANEL_MIN_VISIBLE - base.top;
  /* Si el panel no cabe a lo ancho, `maxX < minX` y este orden deja fijo el
     borde izquierdo: preferimos perder el derecho antes que el inicio del
     texto. */
  return {
    x: Math.max(minX, Math.min(maxX, offset.x)),
    y: Math.max(minY, Math.min(maxY, offset.y)),
  };
}

/* Arranca en `false` para que el render de servidor no asuma un viewport que
   no conoce; el primer efecto lo corrige. El panel solo existe tras una
   selección del usuario, así que no hay parpadeo observable. */
function useIsWideDesktop(): boolean {
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE_DESKTOP_QUERY);
    const update = () => setIsWideDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isWideDesktop;
}

const graph = buildCurriculumGraph(unalCs2024Official.versionCourses);

const stateLabels: Record<DerivedCourseState, string> = {
  AVAILABLE: "Disponible",
  BLOCKED: "Bloqueada",
  COMPLETED: "Completada",
  IN_PROGRESS: "En curso",
};

function GroupingLegendItems() {
  return (
    <>
      {unalCs2024Official.groupings.map((grouping) => (
        <span key={grouping.id}>
          <i className={styles.groupingSwatch} data-grouping={grouping.id} />
          {grouping.name}
        </span>
      ))}
    </>
  );
}

function GraphCourseCard({
  versionCourse,
  state,
  selected,
  dimmed,
  setNodeRef,
  onSelect,
}: {
  versionCourse: VersionCourse;
  state: DerivedCourseState;
  selected: boolean;
  dimmed: boolean;
  setNodeRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
}) {
  const course = coursesById.get(versionCourse.courseId);

  return (
    <article
      ref={setNodeRef}
      data-grouping={versionCourse.groupingId}
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
    </article>
  );
}

export function GraphView() {
  const { trajectory, states, markCourse } = useTrajectory();
  const [selectedId, setSelectedId] = useState<VersionCourseId | null>(null);
  const [edgePositions, setEdgePositions] = useState<EdgePosition[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const graphRegionRef = useRef<HTMLElement>(null);
  const detailPanelRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<VersionCourseId, HTMLElement>());
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);

  /* Arrastre del panel de detalle. Solo en desktop ancho: en <=72rem el panel
     es un bottom sheet y no se mueve. El offset se descarta al cambiar de
     selección, así que al reabrir vuelve a su anclaje inicial (no se persiste). */
  const isWideDesktop = useIsWideDesktop();
  const [panelOffset, setPanelOffset] = useState<PanelOffset>({ x: 0, y: 0 });
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const panelDragRef = useRef<{
    pointerId: number;
    handle: Element;
    startX: number;
    startY: number;
    origin: PanelOffset;
    base: PanelBase;
  } | null>(null);

  useEffect(() => {
    setPanelOffset({ x: 0, y: 0 });
  }, [selectedId]);

  /* Reencuadre al cambiar el viewport: sin esto, un panel movido al borde
     derecho quedaría fuera de pantalla al estrechar la ventana. El listener
     vive solo mientras hay panel abierto en desktop ancho. */
  useEffect(() => {
    if (!isWideDesktop || !selectedId) return;
    const handleResize = () => {
      const panel = detailPanelRef.current;
      if (!panel) return;
      setPanelOffset((current) => {
        if (current.x === 0 && current.y === 0) return current;
        const rect = panel.getBoundingClientRect();
        return clampPanelOffset(current, {
          left: rect.left - current.x,
          top: rect.top - current.y,
          right: rect.right - current.x,
        });
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isWideDesktop, selectedId]);

  const handlePanelPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isWideDesktop || event.button !== 0) return;
    /* Superficie arrastrable = todo el panel MENOS dos cosas: los controles
       —que conservan su gesto propio— y los bloques marcados `data-no-drag`,
       que son texto de contenido donde seleccionar y copiar importa más que
       mover la ventana. El scroll del panel es de rueda, un evento ajeno a
       Pointer Events, así que ampliar la superficie no lo afecta. */
    if (
      event.target instanceof Element &&
      event.target.closest(
        "button, a, input, select, textarea, [role='button'], [contenteditable], [data-no-drag]",
      )
    ) {
      return;
    }
    const panel = detailPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panelDragRef.current = {
      pointerId: event.pointerId,
      handle: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      origin: panelOffset,
      /* Caja del panel sin el transform vigente: la referencia estable contra
         la que se clampea durante todo el gesto. */
      base: {
        left: rect.left - panelOffset.x,
        top: rect.top - panelOffset.y,
        right: rect.right - panelOffset.x,
      },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanelDragging(true);
    /* El pan del grafo no debe ver este gesto. */
    event.stopPropagation();
  };

  const handlePanelPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    event.preventDefault();
    setPanelOffset(
      clampPanelOffset(
        {
          x: drag.origin.x + event.clientX - drag.startX,
          y: drag.origin.y + event.clientY - drag.startY,
        },
        drag.base,
      ),
    );
  };

  const finishPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    panelDragRef.current = null;
    if (drag.handle.hasPointerCapture(event.pointerId)) {
      drag.handle.releasePointerCapture(event.pointerId);
    }
    setIsPanelDragging(false);
  };

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

  const selectedVersionCourse = selectedId
    ? versionCoursesById.get(selectedId)
    : undefined;
  const selectedCourse = selectedVersionCourse
    ? coursesById.get(selectedVersionCourse.courseId)
    : undefined;
  const selectedState = selectedId
    ? (states.get(selectedId) ?? "BLOCKED")
    : undefined;
  const selectedMark: Mark =
    selectedState === "COMPLETED" || selectedState === "IN_PROGRESS"
      ? selectedState
      : "UNMARKED";
  const selectedRequirements = selectedVersionCourse?.requirements
    ? requirementLines(selectedVersionCourse.requirements)
    : [];
  const selectedDerivedState =
    selectedVersionCourse && selectedState === "BLOCKED"
      ? deriveVersionCourseState(
          selectedVersionCourse.id,
          evaluationContext,
          trajectory,
        )
      : undefined;
  const selectedBlockingReasons =
    selectedDerivedState?.state === "BLOCKED" &&
    selectedDerivedState.eligibility.requirementEvaluation
      ? blockingReasons(selectedDerivedState.eligibility.requirementEvaluation)
      : [];

  useEffect(() => {
    if (selectedId) detailPanelRef.current?.focus({ preventScroll: true });
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

    const captureTarget = event.target;
    if (!(captureTarget instanceof Element)) return;

    suppressNextClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      captureTarget,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      startScrollY: window.scrollY,
      moved: false,
    };
    captureTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (hasExceededDragThreshold(deltaX, deltaY, DRAG_THRESHOLD)) {
      dragState.moved = true;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX;
    window.scrollTo(window.scrollX, dragState.startScrollY - deltaY);
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLElement>,
    suppressClick: boolean,
  ) => {
    if (event.pointerType === "touch") return;

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    suppressNextClickRef.current = shouldSuppressClick(
      dragState.moved,
      suppressClick,
    );
    dragStateRef.current = null;
    if (dragState.captureTarget.hasPointerCapture(event.pointerId)) {
      dragState.captureTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  return (
    <main
      className={styles.page}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || selectedId === null) return;
        event.preventDefault();
        setSelectedId(null);
      }}
    >
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
        <nav aria-label="Vistas del plan curricular">
          <Link href="/">Ver plan por componentes</Link>{" "}
          <Link href="/explorar">Explorar mapa curricular</Link>
        </nav>
      </header>

      <section className={styles.controls} aria-label="Leyenda e instrucciones">
        <div className={styles.legend}>
          <span><i className={styles.solidLine} /> Prerrequisito</span>
          <span><i className={styles.dashedLine} /> Correquisito</span>
        </div>
        <div className={styles.groupingLegend}>
          <p className={styles.groupingLegendLabel}>Agrupaciones curriculares</p>
          <div className={styles.groupingList}>
            <GroupingLegendItems />
          </div>
        </div>
        <details className={styles.groupingLegendMobile}>
          <summary>Agrupaciones curriculares</summary>
          <div className={styles.groupingList}>
            <GroupingLegendItems />
          </div>
        </details>
        <p>
          Selecciona una materia para destacar sus relaciones directas. Vuelve a
          seleccionarla para limpiar el foco.
        </p>
      </section>

      <div className={styles.graphNavigation}>
        <p className={styles.dragHint}>Arrastra para explorar el grafo.</p>
        {selectedId ? (
          <button
            type="button"
            className={styles.exitFocusButton}
            onClick={() => setSelectedId(null)}
          >
            Salir del foco
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const graphRegion = graphRegionRef.current;
            if (!graphRegion) return;
            graphRegion.scrollLeft = 0;
            const graphTop = graphRegion.getBoundingClientRect().top + window.scrollY;
            window.scrollTo(0, Math.max(0, graphTop - 16));
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

      <div className={styles.graphWorkspace}>
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
          onClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("article")
            ) {
              return;
            }
            setSelectedId(null);
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
                        dimmed={
                          selectedId !== null &&
                          !relatedIds.has(versionCourse.id)
                        }
                        setNodeRef={(element) => {
                          if (element) {
                            nodeRefs.current.set(versionCourse.id, element);
                          } else {
                            nodeRefs.current.delete(versionCourse.id);
                          }
                        }}
                        onSelect={() =>
                          setSelectedId((current) =>
                            current === versionCourse.id
                              ? null
                              : versionCourse.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        {selectedVersionCourse && selectedState ? (
          <aside
            ref={detailPanelRef}
            className={`${styles.detailPanel} ${isPanelDragging ? styles.panelDragging : ""}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="course-detail-title"
            tabIndex={-1}
            style={
              isWideDesktop && (panelOffset.x !== 0 || panelOffset.y !== 0)
                ? { transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)` }
                : undefined
            }
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={finishPanelDrag}
            onPointerCancel={finishPanelDrag}
          >
            <div className={styles.detailHeader}>
              {/* Lleva el grip que hace descubrible el arrastre; la superficie
                  agarrable, en cambio, es el panel entero. */}
              <div className={styles.detailHeading}>
                <span className={styles.detailEyebrow}>Detalle de materia</span>
                <h2 id="course-detail-title">
                  {selectedCourse?.name ?? "Materia sin nombre"}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedId(null)}>
                Cerrar
              </button>
            </div>

            <dl className={styles.detailFacts} data-no-drag>
              <div>
                <dt>Código</dt>
                <dd>{selectedVersionCourse.academicCode}</dd>
              </div>
              <div>
                <dt>Créditos</dt>
                <dd>{selectedVersionCourse.credits}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>
                  {selectedVersionCourse.mandatory ? "Obligatoria" : "Electiva"}
                </dd>
              </div>
              <div>
                <dt>Estado actual</dt>
                <dd>
                  <span className={styles.stateBadge} data-state={selectedState}>
                    {stateLabels[selectedState]}
                  </span>
                </dd>
              </div>
            </dl>

            <section className={styles.detailSection} data-no-drag>
              <h3>Requisitos</h3>
              {selectedRequirements.length > 0 ? (
                <ul className={styles.requirements}>
                  {selectedRequirements.map((line, index) => (
                    <li key={`${line}-${index}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>Sin requisitos.</p>
              )}
            </section>

            {selectedState === "BLOCKED" ? (
              <section className={styles.detailSection} data-no-drag>
                <h3>Por qué está bloqueada</h3>
                {selectedBlockingReasons.length > 0 ? (
                  <ul className={styles.requirements}>
                    {selectedBlockingReasons.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No cumple los requisitos actuales del plan</p>
                )}
              </section>
            ) : null}

            <section className={styles.detailSection} data-no-drag>
              <h3>Trayectoria</h3>
              <div
                className={styles.actions}
                role="group"
                aria-label={`Trayectoria para ${selectedCourse?.name ?? selectedVersionCourse.academicCode}`}
              >
                {(["UNMARKED", "IN_PROGRESS", "COMPLETED"] as const).map(
                  (mark) => (
                    <button
                      key={mark}
                      type="button"
                      aria-pressed={selectedMark === mark}
                      disabled={
                        selectedState === "BLOCKED" && mark !== "UNMARKED"
                      }
                      onClick={() => markCourse(selectedVersionCourse.id, mark)}
                    >
                      {mark === "UNMARKED"
                        ? "Sin marcar"
                        : mark === "IN_PROGRESS"
                          ? "En curso"
                          : "Completada"}
                    </button>
                  ),
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
