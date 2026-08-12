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
  type KeyboardEvent as ReactKeyboardEvent,
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
import {
  type ExplorerFilterEntry,
  type ExplorerFilters,
  deriveFilterFrontier,
  type FilterFrontierKind,
  filterEntries,
  hasActiveFilters,
  isFilterVisualMode,
  resolveNodeProminence,
  resolveFilterMatchHighlight,
} from "../lib/explorer-filters";
import { type Mark, useTrajectory } from "../lib/trajectory";
import styles from "./explorar-view.module.css";

/* Cuántas sugerencias se ofrecen bajo el buscador. Suficientes para elegir sin
   convertir el desplegable en una segunda lista del plan. */
const MAX_SUGGESTIONS = 8;

const STATE_FILTER_OPTIONS: readonly DerivedCourseState[] = [
  "AVAILABLE",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
];

/* Copy de la frontera contextual. Nunca dice "desbloquea": que B sea destino
   directo de A no garantiza que B quede disponible, porque puede tener otros
   requisitos. Se anuncia como recorrido, no como resultado. */
const frontierLabels: Record<FilterFrontierKind, string> = {
  completed: "Camino siguiente desde una materia completada",
  in_progress: "Camino siguiente desde una materia en curso",
  available: "Camino siguiente desde una materia disponible",
};

/* Devuelve un conjunto nuevo con el valor alternado: los multiselect viven en
   estado de React, así que nunca se mutan en sitio. */
function toggleInSet<T>(source: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(source);
  if (!next.delete(value)) next.add(value);
  return next;
}

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
/* Margen mínimo entre el panel arrastrado y el borde del viewport. */
const PANEL_EDGE_MARGIN = 8;
/* Franja del panel que siempre queda dentro del viewport por abajo, para que
   su cabecera —y con ella el botón de cierre— nunca sea inalcanzable. */
const PANEL_MIN_VISIBLE = 56;

type PanelOffset = { x: number; y: number };
type PanelBase = { left: number; top: number; right: number };

/* El offset es un delta sobre la posición que fija el CSS (`top`/`right` en
   clamp responsive), nunca una posición absoluta: así el panel conserva su
   anclaje inicial y basta con no aplicar el transform para que el bottom sheet
   de tablet/móvil quede intacto. */
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
  filterVisualMode,
}: {
  variant: Variant;
  focus: FocusContext | null;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  /* En modo filtro las aristas y los stems se ocultan ENTEROS: el resultado se
     lee en los nodos. Llega ya resuelto a `false` cuando hay materia enfocada,
     así que aquí no se reimplementa la jerarquía. */
  filterVisualMode: boolean;
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
      /* Una sola bandera en el contenedor oculta los 73 paths y todos los
         stems: sin recorrer elementos, sin tocar la geometría y sin sacar nada
         del DOM. */
      data-filter-mode={filterVisualMode ? "true" : undefined}
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
          /* El stem pertenece al nodo: si el filtro lo descarta, su
             bifurcación se atenúa con él en vez de quedar colgando brillante. */
          return path ? (
            <path
              key={sourceId}
              d={path}
              className={`${styles[relevance]}`}
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
              className={`${styles[relevance]}`}
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

  /* ── Toolbar: búsqueda y filtros ──────────────────────────────────────────
     Todo el estado es local y efímero: no se persiste ni viaja en la URL. Los
     filtros NUNCA tocan el layout ni el estado curricular; solo deciden qué se
     atenúa. */
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ReadonlySet<DerivedCourseState>>(
    () => new Set(),
  );
  const [groupingFilter, setGroupingFilter] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [openMenu, setOpenMenu] = useState<"state" | "grouping" | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Proyección plana para el helper puro. `states` cambia al marcar avance, así
     que la entrada se recalcula con él. */
  const filterEntriesSource: readonly ExplorerFilterEntry[] = useMemo(
    () =>
      unalCs2024Official.versionCourses.map((versionCourse) => ({
        id: versionCourse.id,
        name: coursesById.get(versionCourse.courseId)?.name ?? "",
        academicCode: versionCourse.academicCode,
        groupingId: versionCourse.groupingId,
        groupingName: groupingsById.get(versionCourse.groupingId)?.name ?? "",
        state: states.get(versionCourse.id) ?? "BLOCKED",
      })),
    [states],
  );

  const filters: ExplorerFilters = useMemo(
    () => ({ query, states: stateFilter, groupings: groupingFilter }),
    [query, stateFilter, groupingFilter],
  );
  const filtersActive = hasActiveFilters(filters);
  const matchedIds = useMemo(
    () =>
      new Set(
        filterEntries(filterEntriesSource, filters).map((entry) => entry.id),
      ),
    [filterEntriesSource, filters],
  );

  /* Las sugerencias respetan TODOS los filtros, no solo el texto: si el usuario
     acotó por estado o agrupación, ofrecerle materias descartadas sería
     incoherente con el árbol que está viendo. */
  const suggestions = useMemo(() => {
    if (query.trim() === "") return [];
    return filterEntries(filterEntriesSource, filters).slice(0, MAX_SUGGESTIONS);
  }, [filterEntriesSource, filters, query]);

  const closeMenus = useCallback(() => {
    setOpenMenu(null);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }, []);

  /* Cierre por click fuera. El listener existe solo mientras hay algo abierto,
     nunca de forma permanente. */
  useEffect(() => {
    if (!openMenu && !suggestionsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      if (event.target instanceof Node && toolbar.contains(event.target)) return;
      closeMenus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenu, suggestionsOpen, closeMenus]);

  /* Lleva una materia a la vista moviendo lo MÍNIMO: si ya se ve entera no se
     toca el scroll, y si no, se corrige solo el desbordamiento. Respeta la
     posición que el usuario haya elegido con el pan. */
  const revealCourse = useCallback((id: VersionCourseId) => {
    const region = regionRef.current;
    const node = document.querySelector(`[data-version-course-id="${id}"]`);
    if (!region || !(node instanceof HTMLElement)) return;
    hasUserMovedRef.current = true;
    const nodeBox = node.getBoundingClientRect();
    const regionBox = region.getBoundingClientRect();
    const margin = 24;

    const overflowLeft = regionBox.left + margin - nodeBox.left;
    const overflowRight = nodeBox.right - (regionBox.right - margin);
    if (overflowLeft > 0) region.scrollLeft -= overflowLeft;
    else if (overflowRight > 0) region.scrollLeft += overflowRight;

    const overflowTop = margin - nodeBox.top;
    const overflowBottom = nodeBox.bottom - (window.innerHeight - margin);
    if (overflowTop > 0) window.scrollBy(0, -overflowTop);
    else if (overflowBottom > 0) window.scrollBy(0, overflowBottom);
  }, []);

  /* Elegir una sugerencia usa la MISMA vía que hacer clic en un nodo: selecciona
     y deja que el foco y el panel existentes hagan su trabajo. */
  const chooseCourse = useCallback(
    (id: VersionCourseId) => {
      setSelectedId(id);
      closeMenus();
      /* Tras el re-render el nodo ya tiene su presencia final. */
      requestAnimationFrame(() => revealCourse(id));
    },
    [closeMenus, revealCourse],
  );

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (suggestionsOpen || openMenu) {
        /* No dejar que llegue al `main`, que interpretaría Escape como "salir
           del foco" y cerraría el panel de detalle. */
        event.stopPropagation();
        closeMenus();
      }
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      /* Sin resaltado explícito, Enter resuelve la coincidencia única. */
      const target =
        suggestions[activeSuggestion] ??
        (suggestions.length === 1 ? suggestions[0] : undefined);
      if (target) chooseCourse(target.id as VersionCourseId);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setStateFilter(new Set());
    setGroupingFilter(new Set());
    closeMenus();
    /* Deliberadamente NO se toca `selectedId`: limpiar filtros no debe cerrar
       el panel de detalle que el usuario está leyendo. */
  };

  /* Arrastre del panel de detalle. Solo desktop: en táctil manda el bottom
     sheet y su scroll nativo. El offset se descarta al cambiar de selección,
     así que al reabrir el panel vuelve a su anclaje inicial (no se persiste). */
  const panelRef = useRef<HTMLElement>(null);
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
     vive solo mientras hay panel abierto en desktop. */
  useEffect(() => {
    if (variant !== "desktop" || !selectedId) return;
    const handleResize = () => {
      const panel = panelRef.current;
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
  }, [variant, selectedId]);

  const handlePanelPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (variant !== "desktop" || event.button !== 0) return;
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
    const panel = panelRef.current;
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
    /* El pan del lienzo no debe ver este gesto. */
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

  /* JERARQUÍA VISUAL, en este orden estricto:
       1. selección / foco  — manda siempre;
       2. coincidencia de búsqueda y filtros;
       3. atenuado por no coincidir.
     De ahí que el atenuado por filtro solo se calcule cuando NO hay materia
     seleccionada: bajo foco, el árbol ya habla el lenguaje de unlock /
     prerequisite / future / unrelated, y superponerle un segundo atenuado
     produciría nodos doblemente apagados e ilegibles. Los filtros no se
     pierden —la toolbar sigue mostrando el recuento— y al salir del foco la
     vista filtrada vuelve intacta. */
  const filterVisualMode = isFilterVisualMode({
    filtersActive,
    hasSelection: selectedId !== null,
  });

  /* Frontera contextual: destinos DIRECTOS de las materias que coinciden, para
     que una arista visible no muera en un nodo apagado. Es contexto de
     recorrido, no una promesa de desbloqueo. Se apaga sola bajo foco porque
     comparte la misma puerta `filterVisualMode`. */
  const frontier = useMemo(
    () =>
      deriveFilterFrontier({
        entries: filterEntriesSource,
        edges: graph.edges,
        matchedIds,
        active: filterVisualMode,
      }),
    [filterEntriesSource, matchedIds, filterVisualMode],
  );

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

      {/* Barra de herramientas del mapa. Vive fuera de la región del árbol, así
          que abrir un menú nunca desplaza ni recalcula el lienzo. */}
      <div
        ref={toolbarRef}
        className={styles.toolbar}
        role="search"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (!openMenu && !suggestionsOpen) return;
          event.stopPropagation();
          closeMenus();
          searchInputRef.current?.focus();
        }}
      >
        <div className={styles.searchField}>
          <label htmlFor="explorer-search" className={styles.visuallyHidden}>
            Buscar materia por nombre, código o agrupación
          </label>
          <input
            id="explorer-search"
            ref={searchInputRef}
            type="search"
            className={styles.searchInput}
            placeholder="Buscar materia…"
            value={query}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            /* El listado solo existe en el DOM mientras hay sugerencias, así
               que `aria-controls` no puede apuntar siempre a su id: una
               referencia IDREF rota confunde a los lectores de pantalla. */
            aria-controls={
              suggestionsOpen && suggestions.length > 0
                ? "explorer-suggestions"
                : undefined
            }
            aria-autocomplete="list"
            aria-activedescendant={
              activeSuggestion >= 0 && suggestions[activeSuggestion]
                ? `explorer-suggestion-${suggestions[activeSuggestion].id}`
                : undefined
            }
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
              setOpenMenu(null);
            }}
            onFocus={() => {
              if (query.trim() !== "") setSuggestionsOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {suggestionsOpen && suggestions.length > 0 ? (
            <ul
              id="explorer-suggestions"
              className={styles.suggestions}
              role="listbox"
              aria-label="Materias encontradas"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`explorer-suggestion-${suggestion.id}`}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  className={index === activeSuggestion ? styles.suggestionActive : ""}
                  /* `pointerdown` en vez de `click`: el input pierde el foco
                     antes del click y el listado se cerraría primero. */
                  onPointerDown={(event) => {
                    event.preventDefault();
                    chooseCourse(suggestion.id as VersionCourseId);
                  }}
                  onMouseEnter={() => setActiveSuggestion(index)}
                >
                  <strong>{suggestion.name}</strong>
                  <span>
                    {suggestion.academicCode} · {suggestion.groupingName}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.filterGroup}>
          <button
            type="button"
            className={styles.filterTrigger}
            aria-expanded={openMenu === "state"}
            aria-haspopup="true"
            data-active={stateFilter.size > 0 ? "true" : undefined}
            onClick={() => {
              setOpenMenu((current) => (current === "state" ? null : "state"));
              /* Al cerrar el listado hay que soltar también el índice activo:
                 si no, cambiar un filtro reordena las sugerencias y al reabrir
                 quedaría resaltada —y elegible con Enter— una materia que el
                 usuario nunca señaló. */
              setSuggestionsOpen(false);
              setActiveSuggestion(-1);
            }}
          >
            Estado
            {stateFilter.size > 0 ? <b>{stateFilter.size}</b> : null}
            <span aria-hidden="true">▾</span>
          </button>
          {openMenu === "state" ? (
            <div className={styles.filterMenu} role="group" aria-label="Filtrar por estado">
              {STATE_FILTER_OPTIONS.map((state) => (
                <label key={state}>
                  <input
                    type="checkbox"
                    checked={stateFilter.has(state)}
                    onChange={() =>
                      setStateFilter((current) => toggleInSet(current, state))
                    }
                  />
                  {stateLabels[state]}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.filterGroup}>
          <button
            type="button"
            className={styles.filterTrigger}
            aria-expanded={openMenu === "grouping"}
            aria-haspopup="true"
            data-active={groupingFilter.size > 0 ? "true" : undefined}
            onClick={() => {
              setOpenMenu((current) =>
                current === "grouping" ? null : "grouping",
              );
              setSuggestionsOpen(false);
              setActiveSuggestion(-1);
            }}
          >
            Agrupación
            {groupingFilter.size > 0 ? <b>{groupingFilter.size}</b> : null}
            <span aria-hidden="true">▾</span>
          </button>
          {openMenu === "grouping" ? (
            <div
              className={`${styles.filterMenu} ${styles.groupingMenu}`}
              role="group"
              aria-label="Filtrar por agrupación curricular"
            >
              {unalCs2024Official.groupings.map((grouping) => (
                <label key={grouping.id}>
                  <input
                    type="checkbox"
                    checked={groupingFilter.has(grouping.id)}
                    onChange={() =>
                      setGroupingFilter((current) =>
                        toggleInSet(current, grouping.id),
                      )
                    }
                  />
                  {/* El swatch reutiliza el color de agrupación del árbol. */}
                  <i
                    className={styles.groupingSwatch}
                    data-grouping={grouping.id}
                    aria-hidden="true"
                  />
                  {grouping.name}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {filtersActive ? (
          <button
            type="button"
            className={styles.clearFilters}
            onClick={clearFilters}
          >
            Limpiar
          </button>
        ) : null}

        <p className={styles.resultCount} aria-live="polite">
          {filtersActive
            ? `${matchedIds.size} de ${filterEntriesSource.length} materias`
            : `${filterEntriesSource.length} materias`}
        </p>
      </div>

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
                <Branches
                  variant={variant}
                  focus={focus}
                  states={states}
                  filterVisualMode={filterVisualMode}
                />
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
                      data-version-course-id={versionCourse.id}
                      data-grouping={versionCourse.groupingId}
                      data-state={state}
                      data-relevance={relevance}
                      data-prominence={resolveNodeProminence({
                        filtersActive: filterVisualMode,
                        matched: matchedIds.has(versionCourse.id),
                        frontier: frontier.has(versionCourse.id),
                      })}
                      /* "Puedes cursarla ahora": match real Y disponible. La
                         condición vive completa en el helper, no repartida
                         entre atributos del CSS. */
                      data-match-highlight={
                        resolveFilterMatchHighlight({
                          filterVisualMode,
                          matched: matchedIds.has(versionCourse.id),
                          state,
                        }) ?? undefined
                      }
                      className={`${styles.node} ${selected ? styles.selected : ""}`}
                      onClick={() => setSelectedId(selected ? null : versionCourse.id)}
                      aria-pressed={selected}
                      aria-label={`${course?.name ?? versionCourse.academicCode}. ${stateLabels[state]}.${
                        frontier.has(versionCourse.id)
                          ? ` ${frontierLabels[frontier.get(versionCourse.id)!]}.`
                          : ""
                      } Enfocar relaciones`}
                    >
                      <span className={styles.medallion}>
                        {/* AVAILABLE e IN_PROGRESS comparten el rombo base; a
                            "en curso" lo distingue una barra corta añadida por
                            CSS. BLOCKED no lleva texto: su candado se dibuja
                            con pseudo-elementos. */}
                        <span className={styles.glyph} aria-hidden="true">
                          {state === "COMPLETED"
                            ? "✓"
                            : state === "BLOCKED"
                              ? ""
                              : "◆"}
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
            <aside
              ref={panelRef}
              className={`${styles.detail} ${isPanelDragging ? styles.panelDragging : ""}`}
              aria-live="polite"
              style={
                variant === "desktop" && (panelOffset.x !== 0 || panelOffset.y !== 0)
                  ? { transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)` }
                  : undefined
              }
              onPointerDown={handlePanelPointerDown}
              onPointerMove={handlePanelPointerMove}
              onPointerUp={finishPanelDrag}
              onPointerCancel={finishPanelDrag}
            >
                <button
                  type="button"
                  className={styles.detailClose}
                  onClick={() => setSelectedId(null)}
                  aria-label="Cerrar detalle"
                >
                  <span aria-hidden="true">×</span>
                </button>
                {/* Cabecera: no monopoliza el arrastre —el panel entero es
                    agarrable— pero sí lleva el grip que lo hace descubrible. */}
                <div className={styles.detailHandle}>
                  <p className={styles.eyebrow}>Materia seleccionada</p>
                  <h2>{selectedCourse.name}</h2>
                  <p className={styles.detailCode}>{selectedVersionCourse.academicCode}</p>
                </div>
                <dl data-no-drag>
                  <div><dt>Estado</dt><dd>{stateLabels[selectedState]}</dd></div>
                  <div><dt>Créditos</dt><dd>{selectedVersionCourse.credits}</dd></div>
                  <div>
                    <dt>Agrupación</dt>
                    <dd>{groupingsById.get(selectedVersionCourse.groupingId)?.name}</dd>
                  </div>
                </dl>
                <div className={styles.requirements} data-no-drag>
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
                <div className={styles.requirements} data-no-drag>
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
                <fieldset className={styles.marking} data-no-drag>
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
