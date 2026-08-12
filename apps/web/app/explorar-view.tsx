"use client";

import type { VersionCourseId } from "@sidera/curriculum-domain";
import {
  deriveVersionCourseState,
  type DerivedCourseState,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import Link from "next/link";
import {
  type CSSProperties,
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
  groupingsById,
  requirementLines,
  versionCoursesById,
} from "../lib/curriculum-data";
import { buildCurriculumGraph, type CourseEdge } from "../lib/curriculum-graph";
import {
  hasExceededDragThreshold,
  shouldSuppressClick,
} from "../lib/pointer-gestures";
import {
  buildExplorerLayout,
  EXPLORER_LAYOUT_CONFIGS,
  EXPLORER_NODE_DIAMETER_REM,
  type ExplorerLayout,
} from "../lib/explorer-layout";
import { type Mark, useTrajectory } from "../lib/trajectory";
import styles from "./explorar-view.module.css";

const graph = buildCurriculumGraph(unalCs2024Official.versionCourses);
const layouts = {
  desktop: buildExplorerLayout(
    unalCs2024Official.versionCourses,
    graph,
    EXPLORER_LAYOUT_CONFIGS.desktop,
  ),
  tablet: buildExplorerLayout(
    unalCs2024Official.versionCourses,
    graph,
    EXPLORER_LAYOUT_CONFIGS.tablet,
  ),
  mobile: buildExplorerLayout(
    unalCs2024Official.versionCourses,
    graph,
    EXPLORER_LAYOUT_CONFIGS.mobile,
  ),
};

type Variant = keyof typeof layouts;
/* `rest` = sin selección. Bajo foco: `unlock` (desbloqueo directo),
   `prerequisite` (requisito directo), `future` (alcance futuro dirigido,
   distancia >= 2) y `unrelated`. */
type Relevance =
  | "rest"
  | "unlock"
  | "prerequisite"
  | "future"
  | "unrelated";

const DRAG_THRESHOLD = 5;

const stateLabels: Record<DerivedCourseState, string> = {
  AVAILABLE: "Disponible",
  BLOCKED: "Bloqueada",
  COMPLETED: "Completada",
  IN_PROGRESS: "En curso",
};

function canvasGeometry(layout: ExplorerLayout) {
  const horizontalPadding = 5;
  const topPadding = 6;
  return {
    width: layout.maxX - layout.minX + horizontalPadding * 2,
    height: layout.height + topPadding * 2,
    xOffset: horizontalPadding - layout.minX,
    yOffset: topPadding,
  };
}

const geometry = {
  desktop: canvasGeometry(layouts.desktop),
  tablet: canvasGeometry(layouts.tablet),
  mobile: canvasGeometry(layouts.mobile),
};

function pointFor(layout: ExplorerLayout, variant: Variant, id: VersionCourseId) {
  const position = layout.positions.get(id);
  if (!position) return undefined;
  return {
    x: position.x + geometry[variant].xOffset,
    y: position.y + geometry[variant].yOffset,
  };
}

function outgoingCounts(): ReadonlyMap<VersionCourseId, number> {
  const counts = new Map<VersionCourseId, number>();
  for (const edge of graph.edges) {
    counts.set(edge.sourceId, (counts.get(edge.sourceId) ?? 0) + 1);
  }
  return counts;
}

function incomingCounts(): ReadonlyMap<VersionCourseId, number> {
  const counts = new Map<VersionCourseId, number>();
  for (const edge of graph.edges) {
    counts.set(edge.targetId, (counts.get(edge.targetId) ?? 0) + 1);
  }
  return counts;
}

const outgoingById = outgoingCounts();
const incomingById = incomingCounts();
const STEM_LENGTH_REM = 2.4;

function edgePath(edge: CourseEdge, variant: Variant): string | undefined {
  const layout = layouts[variant];
  const start = pointFor(layout, variant, edge.sourceId);
  const end = pointFor(layout, variant, edge.targetId);
  if (!start || !end) return undefined;
  const sourceRadius = EXPLORER_NODE_DIAMETER_REM / 2;
  const branches = (outgoingById.get(edge.sourceId) ?? 0) > 1;
  /* Si el destino es una reconvergencia, la arista termina donde arranca su
     stem de entrada, para que las ramas se junten antes de tocar el nodo. */
  const converges = (incomingById.get(edge.targetId) ?? 0) > 1;
  const startY = start.y + sourceRadius + (branches ? STEM_LENGTH_REM : 0);
  const endY = end.y - sourceRadius - (converges ? STEM_LENGTH_REM : 0);
  const curveY = startY + (endY - startY) * 0.52;
  return `M ${start.x} ${startY} C ${start.x} ${curveY}, ${end.x} ${curveY}, ${end.x} ${endY}`;
}

/* Stem de salida: bifurcación. Una sola geometría por nodo origen. */
function stemPath(sourceId: VersionCourseId, variant: Variant): string | undefined {
  const point = pointFor(layouts[variant], variant, sourceId);
  if (!point) return undefined;
  const startY = point.y + EXPLORER_NODE_DIAMETER_REM / 2;
  return `M ${point.x} ${startY} L ${point.x} ${startY + STEM_LENGTH_REM}`;
}

/* Stem de entrada: reconvergencia. Una sola geometría por nodo destino, para
   que varios prerrequisitos confluyan en un tramo común antes del nodo. Es
   geometría visual: no aparece en graph.edges, no altera selección ni
   semántica curricular. */
function entryStemPath(
  targetId: VersionCourseId,
  variant: Variant,
): string | undefined {
  const point = pointFor(layouts[variant], variant, targetId);
  if (!point) return undefined;
  const endY = point.y - EXPLORER_NODE_DIAMETER_REM / 2;
  return `M ${point.x} ${endY - STEM_LENGTH_REM} L ${point.x} ${endY}`;
}

type FocusContext = {
  selectedId: VersionCourseId;
  /* Requisitos directos: aristas ENTRANTES a la selección. Se muestran, pero
     nunca propagan transitividad — no se recorre hacia atrás. */
  prerequisites: ReadonlySet<VersionCourseId>;
  /* Distancia dirigida siguiendo SOLO aristas salientes: 1 = desbloqueo
     directo, >= 2 = alcance futuro. Nunca recorre prerrequisitos. */
  forwardDistance: ReadonlyMap<VersionCourseId, number>;
};

/* Recorrido DIRIGIDO hacia adelante desde la selección. Al seguir únicamente
   `sourceId -> targetId` es imposible que ilumine los requisitos de sus
   requisitos: el cono nunca retrocede. */
function buildFocusContext(selectedId: VersionCourseId | null): FocusContext | null {
  if (!selectedId) return null;
  const outgoing = new Map<VersionCourseId, VersionCourseId[]>();
  const prerequisites = new Set<VersionCourseId>();
  for (const edge of graph.edges) {
    outgoing.set(edge.sourceId, [
      ...(outgoing.get(edge.sourceId) ?? []),
      edge.targetId,
    ]);
    if (edge.targetId === selectedId) prerequisites.add(edge.sourceId);
  }

  const forwardDistance = new Map<VersionCourseId, number>([[selectedId, 0]]);
  const pending: VersionCourseId[] = [selectedId];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) continue;
    const nextDistance = (forwardDistance.get(current) ?? 0) + 1;
    for (const target of outgoing.get(current) ?? []) {
      if (forwardDistance.has(target)) continue;
      forwardDistance.set(target, nextDistance);
      pending.push(target);
    }
  }
  return { selectedId, prerequisites, forwardDistance };
}

/* Prioridad de clases, evaluada en este orden estricto para que nunca haya
   combinaciones ambiguas: selección > relaciones directas > alcance futuro >
   resto. El foco siempre gana sobre la señal de progreso. */
function nodeRelevance(id: VersionCourseId, focus: FocusContext | null): Relevance {
  if (!focus) return "rest";
  if (id === focus.selectedId) return "unlock";
  if (focus.prerequisites.has(id)) return "prerequisite";
  const distance = focus.forwardDistance.get(id);
  if (distance === 1) return "unlock";
  if (distance !== undefined && distance >= 2) return "future";
  return "unrelated";
}

function edgeRelevance(edge: CourseEdge, focus: FocusContext | null): Relevance {
  if (!focus) return "rest";
  if (edge.targetId === focus.selectedId) return "prerequisite";
  if (edge.sourceId === focus.selectedId) return "unlock";
  /* Arista del cono hacia adelante: ambos extremos alcanzables siguiendo
     únicamente aristas salientes desde la selección. */
  const from = focus.forwardDistance.get(edge.sourceId);
  const to = focus.forwardDistance.get(edge.targetId);
  if (from !== undefined && to !== undefined) return "future";
  return "unrelated";
}

function Branches({
  variant,
  focus,
  states,
}: {
  variant: Variant;
  focus: FocusContext | null;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
}) {
  const dimensions = geometry[variant];
  const stemSourceIds = [...outgoingById.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  const stemTargetIds = [...incomingById.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  /* El stem es geometría visual, no una arista curricular: se emite una sola
     vez por nodo y su presencia deriva del máximo de las aristas reales que
     representa. */
  const stemRanks: Record<Relevance, number> = {
    unrelated: 0,
    rest: 1,
    future: 2,
    prerequisite: 3,
    unlock: 4,
  };
  const strongestRelevance = (edges: readonly CourseEdge[]): Relevance =>
    edges.reduce<Relevance>((strongest, edge) => {
      const current = edgeRelevance(edge, focus);
      return stemRanks[current] > stemRanks[strongest] ? current : strongest;
    }, focus ? "unrelated" : "rest");

  return (
    <svg
      className={styles.branches}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      width={`${dimensions.width}rem`}
      height={`${dimensions.height}rem`}
      aria-hidden="true"
    >
      <g className={styles.stems}>
        {stemSourceIds.map((sourceId) => {
          const path = stemPath(sourceId, variant);
          const relevance = strongestRelevance(
            graph.edges.filter((edge) => edge.sourceId === sourceId),
          );
          return path ? (
            <path
              key={sourceId}
              d={path}
              className={styles[relevance]}
              data-stem-source={sourceId}
            />
          ) : null;
        })}
        {stemTargetIds.map((targetId) => {
          const path = entryStemPath(targetId, variant);
          const relevance = strongestRelevance(
            graph.edges.filter((edge) => edge.targetId === targetId),
          );
          return path ? (
            <path
              key={`entry-${targetId}`}
              d={path}
              className={styles[relevance]}
              data-stem-target={targetId}
            />
          ) : null;
        })}
      </g>
      <g className={styles.edges}>
        {graph.edges.map((edge) => {
          const path = edgePath(edge, variant);
          const relevance = edgeRelevance(edge, focus);
          /* Requisito cumplido: el ORIGEN de la relación está completado, con
             independencia del estado del destino. Así un destino con varios
             requisitos puede mostrar unos satisfechos y otros pendientes. Es
             solo feedback visual sobre la arista: no cambia ningún estado
             curricular ni marca disponible lo que el engine considera
             bloqueado. */
          const sourceState = states.get(edge.sourceId);
          const satisfied = sourceState === "COMPLETED";
          /* Camino activo: el origen está en curso. Identidad propia (ámbar),
             nunca el azul de requisito cumplido — no significa que el
             requisito esté satisfecho, solo que esa materia está cursándose. */
          const active = sourceState === "IN_PROGRESS";
          return path ? (
            <path
              key={`${edge.sourceId}-${edge.targetId}-${edge.type}`}
              d={path}
              className={`${styles[edge.type.toLowerCase()]} ${styles[relevance]} ${satisfied ? styles.satisfied : ""} ${active ? styles.active : ""}`}
              data-source={edge.sourceId}
              data-target={edge.targetId}
            />
          ) : null;
        })}
      </g>
    </svg>
  );
}

function nodeStyle(id: VersionCourseId, variant: Variant): CSSProperties {
  const point = pointFor(layouts[variant], variant, id);
  return point ? { left: `${point.x}rem`, top: `${point.y}rem` } : {};
}

function useResponsiveVariant(): Variant {
  const [variant, setVariant] = useState<Variant>("desktop");
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 42rem)");
    const tablet = window.matchMedia("(max-width: 76rem)");
    const update = () => setVariant(mobile.matches ? "mobile" : tablet.matches ? "tablet" : "desktop");
    update();
    mobile.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);
  return variant;
}

export function ExplorerView() {
  const { trajectory, states, markCourse } = useTrajectory();
  const variant = useResponsiveVariant();
  const [selectedId, setSelectedId] = useState<VersionCourseId | null>(null);
  const focus = useMemo(() => buildFocusContext(selectedId), [selectedId]);
  const regionRef = useRef<HTMLElement>(null);
  const hasUserMovedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    captureTarget: Element;
    startX: number;
    startY: number;
    scrollLeft: number;
    startScrollY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  /* El árbol conserva su tamaño natural (escala 1): al entrar se centra el
     viewport sobre el centro real del canvas desplazando el scroll de la
     región. No hay relayout, no se reducen labels y no se mueve ningún nodo.
     En móvil no se fuerza el centrado horizontal para no interferir con el
     scroll vertical, que es la navegación principal. */
  const centerViewport = useCallback(() => {
    const region = regionRef.current;
    if (!region || variant === "mobile") return;
    region.scrollLeft = Math.max(0, (region.scrollWidth - region.clientWidth) / 2);
  }, [variant]);

  useLayoutEffect(() => {
    centerViewport();
    const region = regionRef.current;
    if (!region) return;
    /* Recentrar solo mientras el usuario no haya movido el mapa: después de
       una interacción manual se respeta su posición. */
    const observer = new ResizeObserver(() => {
      if (!hasUserMovedRef.current) centerViewport();
    });
    observer.observe(region);
    return () => observer.disconnect();
  }, [centerViewport]);

  /* Pan del LIENZO completo (nunca de un nodo): desplaza el scroll de la
     región. Solo mouse/pen — en táctil manda el scroll nativo, así que no se
     captura el gesto. */
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
      hasUserMovedRef.current = true;
    }
    event.preventDefault();
    /* Eje X: scroll horizontal de la región. Eje Y: scroll del documento — la
       región crece hasta la altura completa del canvas, así que no tiene
       overflow vertical propio y su `scrollTop` no se movería. */
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

  const selectedVersionCourse = selectedId
    ? versionCoursesById.get(selectedId)
    : undefined;
  const selectedCourse = selectedVersionCourse
    ? coursesById.get(selectedVersionCourse.courseId)
    : undefined;
  const selectedState = selectedId ? states.get(selectedId) ?? "BLOCKED" : undefined;
  const selectedMark: Mark =
    selectedState === "COMPLETED" || selectedState === "IN_PROGRESS"
      ? selectedState
      : "UNMARKED";
  const selectedRequirements = selectedVersionCourse?.requirements
    ? requirementLines(selectedVersionCourse.requirements)
    : [];
  const selectedEvaluation =
    selectedVersionCourse && selectedState === "BLOCKED"
      ? deriveVersionCourseState(
          selectedVersionCourse.id,
          evaluationContext,
          trajectory,
        )
      : undefined;
  const reasons =
    selectedEvaluation?.state === "BLOCKED" &&
    selectedEvaluation.eligibility.requirementEvaluation
      ? blockingReasons(selectedEvaluation.eligibility.requirementEvaluation)
      : [];
  /* Dependientes DIRECTOS: materias que esta desbloquea de forma inmediata.
     No se muestra transitividad como si fuera requisito inmediato. */
  const directDependents = selectedId
    ? graph.edges
        .filter((edge) => edge.sourceId === selectedId)
        .map((edge) => versionCoursesById.get(edge.targetId))
        .flatMap((course) => {
          if (!course) return [];
          const name = coursesById.get(course.courseId)?.name;
          return name ? [{ id: course.id, name }] : [];
        })
    : [];

  const canvasStyle: CSSProperties = {
    width: `${geometry[variant].width}rem`,
    height: `${geometry[variant].height}rem`,
  };

  return (
    <main className={styles.page} onKeyDown={(event) => {
      if (event.key === "Escape") setSelectedId(null);
    }}>
      <header className={styles.header}>
        <div>
          <p>Mapa curricular interactivo</p>
          <h1>Explora tu árbol de habilidades</h1>
          <span>De los fundamentos a las ramas avanzadas del programa.</span>
        </div>
        <nav aria-label="Vistas del plan">
          <Link href="/">Vista Plan</Link>
          <Link href="/grafo">Vista Grafo</Link>
        </nav>
      </header>

      <section className={styles.instructions} aria-label="Cómo usar el árbol">
        <p>
          Avanza de arriba hacia abajo. Selecciona una materia para revelar sus
          dependencias reales; las líneas punteadas son correquisitos.
        </p>
        {/* Cada muestra lleva su texto: el significado no depende solo del color. */}
        <ul className={styles.legend}>
          <li>
            <i className={styles.legendSatisfied} aria-hidden="true" />
            Requisito cumplido
          </li>
          <li>
            <i className={styles.legendActive} aria-hidden="true" />
            Camino en curso
          </li>
          <li>
            <i className={styles.legendUnlock} aria-hidden="true" />
            Desbloqueo directo
          </li>
          <li>
            <i className={styles.legendFuture} aria-hidden="true" />
            Alcance futuro
          </li>
        </ul>
        {selectedId ? (
          <button type="button" onClick={() => setSelectedId(null)}>
            Salir del foco
          </button>
        ) : null}
      </section>

      {graph.cycles.length > 0 ? (
        <p className={styles.error}>No se puede representar un currículo con ciclos.</p>
      ) : (
        <div className={styles.workspace}>
          <section
            ref={regionRef}
            className={`${styles.treeRegion} ${isDragging ? styles.dragging : ""}`}
            aria-label="Árbol curricular"
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
            <div className={styles.canvasFrame}>
              <div className={styles.canvas} style={canvasStyle}>
                <Branches variant={variant} focus={focus} states={states} />
              <div className={styles.nodes}>
                {unalCs2024Official.versionCourses.map((versionCourse) => {
                  const course = coursesById.get(versionCourse.courseId);
                  const state = states.get(versionCourse.id) ?? "BLOCKED";
                  const relevance = nodeRelevance(versionCourse.id, focus);
                  const selected = selectedId === versionCourse.id;
                  return (
                    <button
                      type="button"
                      key={versionCourse.id}
                      style={nodeStyle(versionCourse.id, variant)}
                      data-grouping={versionCourse.groupingId}
                      data-state={state}
                      data-relevance={relevance}
                      className={`${styles.node} ${selected ? styles.selected : ""}`}
                      onClick={() => setSelectedId(selected ? null : versionCourse.id)}
                      aria-pressed={selected}
                      aria-label={`${course?.name ?? versionCourse.academicCode}. ${stateLabels[state]}. Enfocar relaciones`}
                    >
                      <span className={styles.medallion}>
                        <span className={styles.glyph} aria-hidden="true">
                          {state === "COMPLETED"
                            ? "✓"
                            : state === "IN_PROGRESS"
                              ? "●"
                              : state === "AVAILABLE"
                                ? "◆"
                                : "·"}
                        </span>
                      </span>
                      <strong>{course?.name ?? "Materia sin nombre"}</strong>
                      <small>{versionCourse.academicCode}</small>
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          </section>

          {selectedVersionCourse && selectedCourse && selectedState ? (
            <aside className={styles.detail} aria-live="polite">
                <button
                  type="button"
                  className={styles.detailClose}
                  onClick={() => setSelectedId(null)}
                  aria-label="Cerrar detalle"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <p className={styles.eyebrow}>Materia seleccionada</p>
                <h2>{selectedCourse.name}</h2>
                <p className={styles.detailCode}>{selectedVersionCourse.academicCode}</p>
                <dl>
                  <div><dt>Estado</dt><dd>{stateLabels[selectedState]}</dd></div>
                  <div><dt>Créditos</dt><dd>{selectedVersionCourse.credits}</dd></div>
                  <div>
                    <dt>Agrupación</dt>
                    <dd>{groupingsById.get(selectedVersionCourse.groupingId)?.name}</dd>
                  </div>
                </dl>
                <div className={styles.requirements}>
                  <h3>Cómo se desbloquea</h3>
                  {selectedRequirements.length > 0 ? (
                    <ul>{selectedRequirements.map((line) => <li key={line}>{line}</li>)}</ul>
                  ) : (
                    <p>No tiene requisitos previos.</p>
                  )}
                  {reasons.length > 0 ? (
                    <ul className={styles.blocking}>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  ) : null}
                </div>
                <div className={styles.requirements}>
                  <h3>Qué desbloquea</h3>
                  {directDependents.length > 0 ? (
                    <ul>
                      {directDependents.map((dependent) => (
                        <li key={dependent.id}>{dependent.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No es requisito directo de ninguna materia.</p>
                  )}
                </div>
                <fieldset className={styles.marking}>
                  <legend>Registrar avance</legend>
                  {(["UNMARKED", "IN_PROGRESS", "COMPLETED"] as const).map((mark) => (
                    <button
                      type="button"
                      key={mark}
                      aria-pressed={selectedMark === mark}
                      onClick={() => markCourse(selectedVersionCourse.id, mark)}
                    >
                      {mark === "UNMARKED" ? "Sin marcar" : mark === "IN_PROGRESS" ? "En curso" : "Completada"}
                    </button>
                  ))}
                </fieldset>
            </aside>
          ) : null}
        </div>
      )}
    </main>
  );
}
