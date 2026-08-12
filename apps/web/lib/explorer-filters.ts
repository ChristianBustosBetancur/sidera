import type { DerivedCourseState } from "@sidera/curriculum-engine";

/* Proyección mínima de una materia para buscar y filtrar. Deliberadamente
   plana y sin identidades del dominio: la lógica de coincidencia no necesita
   conocer el grafo, el engine ni el layout, así que se puede probar sin montar
   React ni construir un currículo completo. */
export type ExplorerFilterEntry = {
  id: string;
  name: string;
  academicCode: string;
  groupingId: string;
  groupingName: string;
  state: DerivedCourseState;
};

export type ExplorerFilters = {
  query: string;
  /* Conjunto vacío = categoría sin filtrar. No se distingue "nada
     seleccionado" de "todo seleccionado": ambos dejan pasar todo. */
  states: ReadonlySet<DerivedCourseState>;
  groupings: ReadonlySet<string>;
};

export const EMPTY_EXPLORER_FILTERS: ExplorerFilters = {
  query: "",
  states: new Set(),
  groupings: new Set(),
};

/* Normalización barata para 60 materias: descompone en NFD, descarta los
   diacríticos combinantes y pasa a minúsculas. Así "Cálculo" se encuentra
   escribiendo "calculo" y viceversa, sin tabla de equivalencias ni
   dependencias. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* Una query vacía no filtra. Se busca por nombre, código y agrupación: los
   tres están disponibles sin coste, y buscar "matematicas" es una forma
   natural de pedir una rama entera. */
export function matchesQuery(
  entry: ExplorerFilterEntry,
  query: string,
): boolean {
  const normalized = normalizeSearchText(query);
  if (normalized === "") return true;
  return [entry.name, entry.academicCode, entry.groupingName].some((field) =>
    normalizeSearchText(field).includes(normalized),
  );
}

/* AND entre categorías, OR dentro de cada multiselect. */
export function matchesFilters(
  entry: ExplorerFilterEntry,
  filters: ExplorerFilters,
): boolean {
  if (!matchesQuery(entry, filters.query)) return false;
  if (filters.states.size > 0 && !filters.states.has(entry.state)) return false;
  if (filters.groupings.size > 0 && !filters.groupings.has(entry.groupingId)) {
    return false;
  }
  return true;
}

export function filterEntries(
  entries: readonly ExplorerFilterEntry[],
  filters: ExplorerFilters,
): ExplorerFilterEntry[] {
  return entries.filter((entry) => matchesFilters(entry, filters));
}

/* Gobierna si la toolbar muestra el contador y habilita "Limpiar", y si el
   árbol atenúa lo no coincidente. Una query de solo espacios no cuenta. */
export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    normalizeSearchText(filters.query) !== "" ||
    filters.states.size > 0 ||
    filters.groupings.size > 0
  );
}

/* ── Frontera contextual del filtro ────────────────────────────────────────
   Destinos DIRECTOS de las materias que sí coinciden, para que una arista
   visible no parezca terminar en la nada. Es contexto de recorrido, nunca una
   promesa de desbloqueo: que B sea frontier de A no significa que B quede
   disponible, porque B puede tener otros requisitos. De ahí que ni el tipo ni
   la copy usen la palabra "desbloquea". */
export type FilterFrontierKind = "completed" | "in_progress" | "available";

/* BLOCKED se asocia deliberadamente a `null`: una materia bloqueada todavía no
   es accionable, así que proyectar "hacia dónde conduce" induciría una lectura
   incorrecta. El contexto de una bloqueada es qué la bloquea —prerrequisitos
   ENTRANTES— y eso es otra tarea. */
const FRONTIER_KIND_BY_STATE: Record<
  DerivedCourseState,
  FilterFrontierKind | null
> = {
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
  AVAILABLE: "available",
  BLOCKED: null,
};

/* Progreso consolidado > progreso activo > posibilidad futura. Con pesos, un
   destino alcanzado desde varios orígenes recibe SIEMPRE la misma decoración
   con independencia del orden en que se recorran las aristas. */
const FRONTIER_PRIORITY: Record<FilterFrontierKind, number> = {
  completed: 3,
  in_progress: 2,
  available: 1,
};

export type FrontierEdgeInput = {
  sourceId: string;
  targetId: string;
};

/* Un solo salto desde cada match real. Un destino que YA es match real nunca
   entra como frontier: match real gana, y la semántica no se duplica. */
export function deriveFilterFrontier(input: {
  entries: readonly ExplorerFilterEntry[];
  edges: readonly FrontierEdgeInput[];
  matchedIds: ReadonlySet<string>;
  /* El llamador pasa `false` cuando no hay filtros o cuando hay una materia
     enfocada: bajo foco el árbol habla el lenguaje del foco y esta capa
     desaparece por completo. */
  active: boolean;
}): ReadonlyMap<string, FilterFrontierKind> {
  const frontier = new Map<string, FilterFrontierKind>();
  if (!input.active) return frontier;

  const stateById = new Map(
    input.entries.map((entry) => [entry.id, entry.state]),
  );

  for (const edge of input.edges) {
    if (!input.matchedIds.has(edge.sourceId)) continue;
    if (input.matchedIds.has(edge.targetId)) continue;
    const sourceState = stateById.get(edge.sourceId);
    if (!sourceState) continue;
    const kind = FRONTIER_KIND_BY_STATE[sourceState];
    if (!kind) continue;
    const current = frontier.get(edge.targetId);
    if (!current || FRONTIER_PRIORITY[kind] > FRONTIER_PRIORITY[current]) {
      frontier.set(edge.targetId, kind);
    }
  }
  return frontier;
}

/* Realce de los match reales cuyo estado dice algo accionable sobre el
   presente del estudiante.

   Solo dos estados lo reciben, y por eso el mapa es explícito en vez de una
   cadena de condiciones: AVAILABLE ("puedes cursarla ahora") e IN_PROGRESS
   ("la estás cursando ahora"). COMPLETED y BLOCKED conservan su apariencia
   propia sin anillo adicional — ya se distinguen por fondo y glifo, y sumarles
   un halo convertiría el filtro en un semáforo de cuatro colores.

   Es una conjunción estricta, no un derivado del estado a secas: sin filtros el
   árbol no destaca nada, y bajo foco la capa entera desaparece. La frontera
   nunca lo recibe, porque no pertenece a `matchedIds`. */
export type FilterMatchHighlight = "available" | "in_progress";

const MATCH_HIGHLIGHT_BY_STATE: Record<
  DerivedCourseState,
  FilterMatchHighlight | null
> = {
  AVAILABLE: "available",
  IN_PROGRESS: "in_progress",
  COMPLETED: null,
  BLOCKED: null,
};

export function resolveFilterMatchHighlight(input: {
  filterVisualMode: boolean;
  matched: boolean;
  state: DerivedCourseState;
}): FilterMatchHighlight | null {
  if (!input.filterVisualMode || !input.matched) return null;
  return MATCH_HIGHLIGHT_BY_STATE[input.state];
}

/* En modo filtro el árbol comunica el resultado con NODOS, no con aristas:
   aristas y stems se ocultan por completo para que 73 líneas no vuelvan a
   convertir la vista en una telaraña. Con una materia seleccionada el modo se
   apaga y las aristas recuperan íntegra su semántica de foco.
   Es la misma puerta que gobierna el atenuado, la frontera y el realce de
   disponibilidad, expresada una sola vez. */
export function isFilterVisualMode(input: {
  filtersActive: boolean;
  hasSelection: boolean;
}): boolean {
  return input.filtersActive && !input.hasSelection;
}

/* Prominencia de un nodo bajo el filtro: los tres niveles con que se lee el
   resultado ahora que las aristas no participan. */
export type NodeProminence = "normal" | "strong" | "context" | "dim";

export function resolveNodeProminence(input: {
  filtersActive: boolean;
  matched: boolean;
  frontier: boolean;
}): NodeProminence {
  if (!input.filtersActive) return "normal";
  if (input.matched) return "strong";
  if (input.frontier) return "context";
  return "dim";
}
