import { describe, expect, it } from "vitest";
import {
  EMPTY_EXPLORER_FILTERS,
  type ExplorerFilterEntry,
  type ExplorerFilters,
  deriveFilterFrontier,
  filterEntries,
  hasActiveFilters,
  isFilterVisualMode,
  matchesFilters,
  matchesQuery,
  normalizeSearchText,
  resolveNodeProminence,
  resolveFilterMatchHighlight,
} from "./explorer-filters";

function entry(
  overrides: Partial<ExplorerFilterEntry> & Pick<ExplorerFilterEntry, "id">,
): ExplorerFilterEntry {
  return {
    name: "Cálculo diferencial",
    academicCode: "1000004-M",
    groupingId: "mathematics",
    groupingName: "Matemáticas",
    state: "AVAILABLE",
    ...overrides,
  };
}

const differentialCalculus = entry({ id: "calc" });
const programming = entry({
  id: "prog",
  name: "Programación orientada a objetos",
  academicCode: "2015181",
  groupingId: "programming",
  groupingName: "Programación",
  state: "IN_PROGRESS",
});
const algorithms = entry({
  id: "algo",
  name: "Análisis de algoritmos",
  academicCode: "2016326",
  groupingId: "algorithms",
  groupingName: "Algoritmos y Computación",
  state: "BLOCKED",
});

const catalog = [differentialCalculus, programming, algorithms];

function filters(overrides: Partial<ExplorerFilters> = {}): ExplorerFilters {
  return { ...EMPTY_EXPLORER_FILTERS, ...overrides };
}

describe("normalizeSearchText", () => {
  it("descarta diacríticos y unifica mayúsculas", () => {
    expect(normalizeSearchText("Cálculo")).toBe("calculo");
    expect(normalizeSearchText("PROGRAMACIÓN")).toBe("programacion");
  });

  it("recorta espacios de los extremos pero conserva los internos", () => {
    expect(normalizeSearchText("  análisis de algoritmos  ")).toBe(
      "analisis de algoritmos",
    );
  });
});

describe("matchesQuery", () => {
  it("encuentra por nombre, ignorando tildes en ambos sentidos", () => {
    expect(matchesQuery(differentialCalculus, "calculo")).toBe(true);
    expect(matchesQuery(differentialCalculus, "cálculo")).toBe(true);
  });

  it("encuentra por código académico", () => {
    expect(matchesQuery(programming, "2015181")).toBe(true);
    expect(matchesQuery(programming, "1000004")).toBe(false);
  });

  it("encuentra por nombre de agrupación", () => {
    expect(matchesQuery(algorithms, "computacion")).toBe(true);
  });

  it("una query vacía o de solo espacios no filtra", () => {
    expect(matchesQuery(algorithms, "")).toBe(true);
    expect(matchesQuery(algorithms, "   ")).toBe(true);
  });

  it("no coincide cuando el texto no aparece en ningún campo", () => {
    expect(matchesQuery(differentialCalculus, "biología")).toBe(false);
  });
});

describe("matchesFilters", () => {
  it("sin filtros deja pasar todo", () => {
    expect(filterEntries(catalog, EMPTY_EXPLORER_FILTERS)).toHaveLength(3);
  });

  it("aplica OR dentro del multiselect de estados", () => {
    const result = filterEntries(
      catalog,
      filters({ states: new Set(["AVAILABLE", "IN_PROGRESS"]) }),
    );
    expect(result.map((item) => item.id)).toEqual(["calc", "prog"]);
  });

  it("aplica OR dentro del multiselect de agrupaciones", () => {
    const result = filterEntries(
      catalog,
      filters({ groupings: new Set(["mathematics", "programming"]) }),
    );
    expect(result.map((item) => item.id)).toEqual(["calc", "prog"]);
  });

  it("un multiselect vacío no restringe su categoría", () => {
    expect(matchesFilters(algorithms, filters({ states: new Set() }))).toBe(
      true,
    );
    expect(matchesFilters(algorithms, filters({ groupings: new Set() }))).toBe(
      true,
    );
  });

  it("combina las categorías con AND", () => {
    const combined = filters({
      query: "cal",
      states: new Set(["AVAILABLE", "IN_PROGRESS"]),
      groupings: new Set(["mathematics", "programming"]),
    });
    /* Cálculo cumple las tres; Programación cumple estado y agrupación pero
       falla la query; Algoritmos falla las tres. */
    expect(filterEntries(catalog, combined).map((item) => item.id)).toEqual([
      "calc",
    ]);
  });

  it("una sola categoría incumplida descarta la materia", () => {
    const combined = filters({
      query: "calculo",
      states: new Set(["COMPLETED"]),
    });
    expect(matchesFilters(differentialCalculus, combined)).toBe(false);
  });

  it("puede no devolver ninguna coincidencia", () => {
    expect(
      filterEntries(catalog, filters({ query: "materia inexistente" })),
    ).toHaveLength(0);
  });
});

describe("hasActiveFilters", () => {
  it("es falso sin filtros y con query de solo espacios", () => {
    expect(hasActiveFilters(EMPTY_EXPLORER_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ query: "   " }))).toBe(false);
  });

  it("es verdadero con query, estados o agrupaciones", () => {
    expect(hasActiveFilters(filters({ query: "cal" }))).toBe(true);
    expect(hasActiveFilters(filters({ states: new Set(["BLOCKED"]) }))).toBe(
      true,
    );
    expect(
      hasActiveFilters(filters({ groupings: new Set(["mathematics"]) })),
    ).toBe(true);
  });

  it("limpiar filtros restaura el catálogo completo (contexto de edges)", () => {
    const active = filters({
      query: "cal",
      states: new Set(["AVAILABLE"]),
      groupings: new Set(["mathematics"]),
    });
    expect(filterEntries(catalog, active)).toHaveLength(1);
    expect(hasActiveFilters(EMPTY_EXPLORER_FILTERS)).toBe(false);
    expect(filterEntries(catalog, EMPTY_EXPLORER_FILTERS)).toHaveLength(3);
  });
});

describe("deriveFilterFrontier", () => {
  /* A(match) -> B -> C. Sirve para comprobar que el salto es UNO solo. */
  const chainEntries = [
    entry({ id: "a", name: "Cálculo diferencial", state: "COMPLETED" }),
    entry({ id: "b", name: "Cálculo integral", state: "AVAILABLE" }),
    entry({ id: "c", name: "Ecuaciones diferenciales", state: "BLOCKED" }),
  ];
  const chainEdges = [
    { sourceId: "a", targetId: "b" },
    { sourceId: "b", targetId: "c" },
  ];

  function derive(
    entries: readonly ExplorerFilterEntry[],
    edges: readonly { sourceId: string; targetId: string }[],
    active: ExplorerFilters,
    overrides: { activeFlag?: boolean } = {},
  ) {
    const matchedIds = new Set(
      filterEntries(entries, active).map((item) => item.id),
    );
    return {
      matchedIds,
      frontier: deriveFilterFrontier({
        entries,
        edges,
        matchedIds,
        active: overrides.activeFlag ?? hasActiveFilters(active),
      }),
    };
  }

  it("1. un match COMPLETED proyecta su destino directo", () => {
    const { frontier } = derive(
      chainEntries,
      chainEdges,
      filters({ states: new Set(["COMPLETED"]) }),
    );
    expect(frontier.get("b")).toBe("completed");
  });

  it("2. un match IN_PROGRESS proyecta su destino directo", () => {
    const entries = [
      entry({ id: "a", state: "IN_PROGRESS" }),
      entry({ id: "b", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [{ sourceId: "a", targetId: "b" }],
      filters({ states: new Set(["IN_PROGRESS"]) }),
    );
    expect(frontier.get("b")).toBe("in_progress");
  });

  it("3. un match AVAILABLE proyecta su destino directo", () => {
    const entries = [
      entry({ id: "a", state: "AVAILABLE" }),
      entry({ id: "b", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [{ sourceId: "a", targetId: "b" }],
      filters({ states: new Set(["AVAILABLE"]) }),
    );
    expect(frontier.get("b")).toBe("available");
  });

  it("4. un match BLOCKED no proyecta frontera hacia adelante", () => {
    const entries = [
      entry({ id: "a", state: "BLOCKED" }),
      entry({ id: "b", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [{ sourceId: "a", targetId: "b" }],
      filters({ states: new Set(["BLOCKED"]) }),
    );
    expect(frontier.size).toBe(0);
  });

  it("5. avanza un solo salto: A->B->C deja C fuera", () => {
    const { frontier } = derive(
      chainEntries,
      chainEdges,
      filters({ states: new Set(["COMPLETED"]) }),
    );
    expect(frontier.has("b")).toBe(true);
    expect(frontier.has("c")).toBe(false);
  });

  it("6. un destino que ya es match real no entra como frontera", () => {
    const entries = [
      entry({ id: "a", state: "COMPLETED" }),
      entry({ id: "b", state: "COMPLETED" }),
    ];
    const { matchedIds, frontier } = derive(
      entries,
      [{ sourceId: "a", targetId: "b" }],
      filters({ states: new Set(["COMPLETED"]) }),
    );
    expect(matchedIds.has("b")).toBe(true);
    expect(frontier.has("b")).toBe(false);
  });

  it("7. la query restringe qué materias generan frontera", () => {
    const entries = [
      entry({ id: "a", name: "Cálculo diferencial", state: "COMPLETED" }),
      entry({ id: "z", name: "Química general", state: "COMPLETED" }),
      entry({ id: "b", state: "BLOCKED" }),
      entry({ id: "y", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [
        { sourceId: "a", targetId: "b" },
        { sourceId: "z", targetId: "y" },
      ],
      filters({ query: "calculo", states: new Set(["COMPLETED"]) }),
    );
    expect(frontier.has("b")).toBe(true);
    expect(frontier.has("y")).toBe(false);
  });

  it("8. la agrupación restringe los orígenes, pero el destino no la hereda", () => {
    const entries = [
      entry({ id: "a", groupingId: "mathematics", state: "COMPLETED" }),
      entry({ id: "z", groupingId: "programming", state: "COMPLETED" }),
      entry({ id: "b", groupingId: "programming", state: "BLOCKED" }),
      entry({ id: "y", groupingId: "programming", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [
        { sourceId: "a", targetId: "b" },
        { sourceId: "z", targetId: "y" },
      ],
      filters({ groupings: new Set(["mathematics"]) }),
    );
    /* `a` es el único origen que pasa el filtro; su destino entra aunque
       pertenezca a otra agrupación, porque es contexto de recorrido. */
    expect(frontier.has("b")).toBe(true);
    expect(frontier.has("y")).toBe(false);
  });

  it("9. multiselect COMPLETED + IN_PROGRESS expande desde ambos", () => {
    const entries = [
      entry({ id: "done", state: "COMPLETED" }),
      entry({ id: "wip", state: "IN_PROGRESS" }),
      entry({ id: "t1", state: "BLOCKED" }),
      entry({ id: "t2", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [
        { sourceId: "done", targetId: "t1" },
        { sourceId: "wip", targetId: "t2" },
      ],
      filters({ states: new Set(["COMPLETED", "IN_PROGRESS"]) }),
    );
    expect(frontier.get("t1")).toBe("completed");
    expect(frontier.get("t2")).toBe("in_progress");
  });

  it("10. BLOCKED + AVAILABLE: solo los disponibles expanden", () => {
    const entries = [
      entry({ id: "blocked", state: "BLOCKED" }),
      entry({ id: "free", state: "AVAILABLE" }),
      entry({ id: "t1", state: "COMPLETED" }),
      entry({ id: "t2", state: "COMPLETED" }),
    ];
    const { matchedIds, frontier } = derive(
      entries,
      [
        { sourceId: "blocked", targetId: "t1" },
        { sourceId: "free", targetId: "t2" },
      ],
      filters({ states: new Set(["BLOCKED", "AVAILABLE"]) }),
    );
    /* La bloqueada sigue siendo un match normal, pero no proyecta contexto. */
    expect(matchedIds.has("blocked")).toBe(true);
    expect(frontier.has("t1")).toBe(false);
    expect(frontier.get("t2")).toBe("available");
  });

  it("11. destino alcanzado desde COMPLETED e IN_PROGRESS: gana completed", () => {
    const entries = [
      entry({ id: "done", state: "COMPLETED" }),
      entry({ id: "wip", state: "IN_PROGRESS" }),
      entry({ id: "shared", state: "BLOCKED" }),
    ];
    const forward = derive(
      entries,
      [
        { sourceId: "done", targetId: "shared" },
        { sourceId: "wip", targetId: "shared" },
      ],
      filters({ states: new Set(["COMPLETED", "IN_PROGRESS"]) }),
    );
    const reversed = derive(
      entries,
      [
        { sourceId: "wip", targetId: "shared" },
        { sourceId: "done", targetId: "shared" },
      ],
      filters({ states: new Set(["COMPLETED", "IN_PROGRESS"]) }),
    );
    /* El resultado no depende del orden de recorrido de las aristas. */
    expect(forward.frontier.get("shared")).toBe("completed");
    expect(reversed.frontier.get("shared")).toBe("completed");
  });

  it("12. destino alcanzado desde IN_PROGRESS y AVAILABLE: gana in_progress", () => {
    const entries = [
      entry({ id: "wip", state: "IN_PROGRESS" }),
      entry({ id: "free", state: "AVAILABLE" }),
      entry({ id: "shared", state: "BLOCKED" }),
    ];
    const { frontier } = derive(
      entries,
      [
        { sourceId: "free", targetId: "shared" },
        { sourceId: "wip", targetId: "shared" },
      ],
      filters({ states: new Set(["IN_PROGRESS", "AVAILABLE"]) }),
    );
    expect(frontier.get("shared")).toBe("in_progress");
  });

  it("13. la frontera no altera el recuento de resultados", () => {
    const { matchedIds, frontier } = derive(
      chainEntries,
      chainEdges,
      filters({ states: new Set(["COMPLETED"]) }),
    );
    expect(matchedIds.size).toBe(1);
    expect(frontier.size).toBe(1);
    /* El contador de la toolbar lee matchedIds, nunca la suma. */
    expect(matchedIds.size).not.toBe(matchedIds.size + frontier.size);
  });

  it("14. sin filtros activos la frontera está vacía", () => {
    const { frontier } = derive(
      chainEntries,
      chainEdges,
      EMPTY_EXPLORER_FILTERS,
    );
    expect(frontier.size).toBe(0);
  });

  it("15. con materia enfocada la frontera se apaga (active=false)", () => {
    const { frontier } = derive(
      chainEntries,
      chainEdges,
      filters({ states: new Set(["COMPLETED"]) }),
      { activeFlag: false },
    );
    expect(frontier.size).toBe(0);
  });
});

describe("isFilterVisualMode", () => {
  it("1. filtros activos y sin selección => modo filtro visual", () => {
    expect(
      isFilterVisualMode({ filtersActive: true, hasSelection: false }),
    ).toBe(true);
  });

  it("2. con una materia seleccionada el modo filtro se apaga", () => {
    /* El foco recupera el mando: las aristas vuelven con su semántica normal
       y las decoraciones de filtro desaparecen. */
    expect(
      isFilterVisualMode({ filtersActive: true, hasSelection: true }),
    ).toBe(false);
  });

  it("9. limpiar los filtros apaga el modo filtro visual", () => {
    expect(hasActiveFilters(EMPTY_EXPLORER_FILTERS)).toBe(false);
    expect(
      isFilterVisualMode({
        filtersActive: hasActiveFilters(EMPTY_EXPLORER_FILTERS),
        hasSelection: false,
      }),
    ).toBe(false);
  });
});

describe("modo filtro: los nodos son el lenguaje", () => {
  const catalogo = [
    entry({ id: "free", name: "Cálculo diferencial", state: "AVAILABLE" }),
    entry({ id: "done", name: "Álgebra lineal", state: "COMPLETED" }),
    entry({ id: "next", name: "Cálculo integral", state: "BLOCKED" }),
    entry({ id: "far", name: "Química general", state: "BLOCKED" }),
  ];
  const aristas = [
    { sourceId: "free", targetId: "next" },
    { sourceId: "done", targetId: "next" },
    { sourceId: "far", targetId: "free" },
  ];

  function escenario(active: ExplorerFilters, hasSelection = false) {
    const filtersActive = hasActiveFilters(active);
    const visualMode = isFilterVisualMode({ filtersActive, hasSelection });
    const matchedIds = new Set(
      filterEntries(catalogo, active).map((item) => item.id),
    );
    return {
      matchedIds,
      visualMode,
      frontier: deriveFilterFrontier({
        entries: catalogo,
        edges: aristas,
        matchedIds,
        active: visualMode,
      }),
    };
  }

  it("3. la frontera se sigue derivando aunque las aristas se oculten", () => {
    const { visualMode, frontier } = escenario(
      filters({ states: new Set(["AVAILABLE"]) }),
    );
    /* Las aristas no se ven, pero la relación directa se conoce igual: ahora
       se comunica con el halo del nodo. */
    expect(visualMode).toBe(true);
    expect(frontier.has("next")).toBe(true);
  });

  it("4. un match real nunca recibe decoración de frontera", () => {
    const { matchedIds, frontier } = escenario(
      filters({ states: new Set(["AVAILABLE", "BLOCKED"]) }),
    );
    for (const id of matchedIds) {
      expect(frontier.has(id)).toBe(false);
    }
  });

  it("5. filtrar solo por Bloqueada no produce ninguna frontera", () => {
    const { matchedIds, frontier } = escenario(
      filters({ states: new Set(["BLOCKED"]) }),
    );
    expect(matchedIds.size).toBe(2);
    expect(frontier.size).toBe(0);
  });

  it("6. un AVAILABLE que hace match conserva su realce de disponibilidad", () => {
    const { matchedIds, visualMode } = escenario(
      filters({ states: new Set(["AVAILABLE"]) }),
    );
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode: visualMode,
        matched: matchedIds.has("free"),
        state: "AVAILABLE",
      }),
    ).toBe("available");
  });

  it("7. la frontera se decora de forma uniforme sea cual sea su origen", () => {
    /* `next` es destino directo de una disponible y de una completada a la
       vez. La prioridad interna sigue siendo determinista, pero la vista ya no
       la traduce a tres colores: todo frontier se pinta igual. */
    const { frontier } = escenario(
      filters({ states: new Set(["AVAILABLE", "COMPLETED"]) }),
    );
    expect(frontier.get("next")).toBe("completed");
    expect([...frontier.keys()]).toEqual(["next"]);
  });

  it("8. el contador sigue excluyendo la frontera", () => {
    const { matchedIds, frontier } = escenario(
      filters({ states: new Set(["AVAILABLE"]) }),
    );
    expect(matchedIds.size).toBe(1);
    expect(frontier.size).toBe(1);
  });

  it("10. multiselect sigue produciendo la frontera correcta", () => {
    const { matchedIds, frontier } = escenario(
      filters({ states: new Set(["AVAILABLE", "COMPLETED"]) }),
    );
    expect([...matchedIds].sort()).toEqual(["done", "free"]);
    expect(frontier.has("next")).toBe(true);
    /* `far` no es destino de ningún match, así que no entra. */
    expect(frontier.has("far")).toBe(false);
  });

  it("con selección, el modo se apaga y la frontera queda vacía", () => {
    const { visualMode, frontier } = escenario(
      filters({ states: new Set(["AVAILABLE"]) }),
      true,
    );
    expect(visualMode).toBe(false);
    expect(frontier.size).toBe(0);
  });
});

describe("resolveNodeProminence", () => {
  const active = { filtersActive: true };

  it("un match real es protagonista", () => {
    expect(
      resolveNodeProminence({ ...active, matched: true, frontier: false }),
    ).toBe("strong");
  });

  it("la frontera queda por encima del descarte y por debajo del match", () => {
    expect(
      resolveNodeProminence({ ...active, matched: false, frontier: true }),
    ).toBe("context");
  });

  it("lo que no coincide ni es frontera se atenúa", () => {
    expect(
      resolveNodeProminence({ ...active, matched: false, frontier: false }),
    ).toBe("dim");
  });

  it("sin modo filtro ningún nodo cambia de prominencia", () => {
    expect(
      resolveNodeProminence({
        filtersActive: false,
        matched: false,
        frontier: false,
      }),
    ).toBe("normal");
  });
});

describe("resolveFilterMatchHighlight", () => {
  const active = { filterVisualMode: true, matched: true } as const;

  it("1. IN_PROGRESS que hace match recibe el realce dorado", () => {
    expect(
      resolveFilterMatchHighlight({ ...active, state: "IN_PROGRESS" }),
    ).toBe("in_progress");
  });

  it("2. una frontera IN_PROGRESS no recibe realce de match", () => {
    /* La frontera nunca pertenece a `matchedIds`, de ahí `matched: false`. */
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode: true,
        matched: false,
        state: "IN_PROGRESS",
      }),
    ).toBeNull();
  });

  it("3. AVAILABLE que hace match sigue recibiendo su realce verde-cian", () => {
    expect(resolveFilterMatchHighlight({ ...active, state: "AVAILABLE" })).toBe(
      "available",
    );
  });

  it("4. COMPLETED que hace match no recibe halo adicional", () => {
    expect(
      resolveFilterMatchHighlight({ ...active, state: "COMPLETED" }),
    ).toBeNull();
  });

  it("5. BLOCKED que hace match no recibe halo adicional", () => {
    expect(
      resolveFilterMatchHighlight({ ...active, state: "BLOCKED" }),
    ).toBeNull();
  });

  it("6. con materia enfocada el realce IN_PROGRESS desaparece", () => {
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode: false,
        matched: true,
        state: "IN_PROGRESS",
      }),
    ).toBeNull();
  });

  it("7. sin filtros activos no hay realce de ningún estado", () => {
    for (const state of ["AVAILABLE", "IN_PROGRESS"] as const) {
      expect(
        resolveFilterMatchHighlight({
          filterVisualMode: false,
          matched: true,
          state,
        }),
      ).toBeNull();
    }
  });
});

describe("multiselect AVAILABLE + IN_PROGRESS", () => {
  const catalogo = [
    entry({ id: "free", name: "Cálculo diferencial", state: "AVAILABLE" }),
    entry({ id: "wip", name: "Álgebra lineal", state: "IN_PROGRESS" }),
    entry({ id: "next", name: "Cálculo integral", state: "BLOCKED" }),
  ];
  const aristas = [
    { sourceId: "free", targetId: "next" },
    { sourceId: "wip", targetId: "next" },
  ];
  const seleccion = filters({ states: new Set(["AVAILABLE", "IN_PROGRESS"]) });
  const filterVisualMode = isFilterVisualMode({
    filtersActive: hasActiveFilters(seleccion),
    hasSelection: false,
  });
  const matchedIds = new Set(
    filterEntries(catalogo, seleccion).map((item) => item.id),
  );
  const frontera = deriveFilterFrontier({
    entries: catalogo,
    edges: aristas,
    matchedIds,
    active: filterVisualMode,
  });

  it("8. cada match recibe el realce de su propio estado", () => {
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode,
        matched: matchedIds.has("free"),
        state: "AVAILABLE",
      }),
    ).toBe("available");
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode,
        matched: matchedIds.has("wip"),
        state: "IN_PROGRESS",
      }),
    ).toBe("in_progress");
  });

  it("9. la frontera se decora de forma uniforme, nunca con el dorado", () => {
    /* `next` es destino de una disponible y de una en curso: recibe una sola
       decoración, y no es la de match. */
    expect(frontera.has("next")).toBe(true);
    expect(
      resolveFilterMatchHighlight({
        filterVisualMode,
        matched: matchedIds.has("next"),
        state: "BLOCKED",
      }),
    ).toBeNull();
  });

  it("10. un match real nunca es también frontera", () => {
    for (const id of matchedIds) {
      expect(frontera.has(id)).toBe(false);
    }
  });
});
