import type {
  ComponentId,
  GroupingId,
  PlanVersionId,
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import { describe, expect, it } from "vitest";
import { reconcileTrajectory } from "./reconciliation.js";
import type {
  CurriculumEvaluationContext,
  StudentTrajectory,
} from "./types.js";

const planVersionId = "plan" as PlanVersionId;
const componentId = "componente" as ComponentId;
const groupingId = "agrupacion" as GroupingId;

function course(
  id: string,
  requirements?: RequirementExpression,
  credits = 3,
): VersionCourse {
  return {
    id: id as VersionCourseId,
    planVersionId,
    courseId: `curso-${id}` as VersionCourse["courseId"],
    groupingId,
    academicCode: id,
    credits,
    mandatory: true,
    ...(requirements ? { requirements } : {}),
  };
}

function context(versionCourses: readonly VersionCourse[]): CurriculumEvaluationContext {
  return {
    planVersionId,
    versionCourses,
    groupings: [
      { id: groupingId, componentId, name: "Agrupación", requiredCredits: 100 },
    ],
    components: [
      { id: componentId, planVersionId, name: "Componente", requiredCredits: 100 },
    ],
  };
}

const needs = (id: string): RequirementExpression => ({
  type: "COURSE_COMPLETED",
  versionCourseId: id as VersionCourseId,
});

const concurrent = (id: string): RequirementExpression => ({
  type: "COURSE_COMPLETED_OR_CONCURRENT",
  versionCourseId: id as VersionCourseId,
});

function trajectory(
  completed: readonly string[],
  inProgress: readonly string[],
): StudentTrajectory {
  return {
    completedVersionCourseIds: completed as readonly VersionCourseId[],
    inProgressVersionCourseIds: inProgress as readonly VersionCourseId[],
  };
}

const unmark = (id: string) =>
  ({ versionCourseId: id as VersionCourseId, mark: "UNMARKED" }) as const;

const ids = (list: readonly { versionCourseId: VersionCourseId }[]) =>
  list.map((item) => String(item.versionCourseId)).sort();

describe("reconcileTrajectory — cambios sin impacto", () => {
  it("desmarcar una hoja terminal no invalida nada", () => {
    const plan = context([course("a"), course("b", needs("a"))]);
    const result = reconcileTrajectory(unmark("b"), plan, trajectory(["a"], ["b"]));
    expect(result.invalidations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("un cambio en una rama independiente no toca la otra", () => {
    const plan = context([
      course("a"),
      course("b", needs("a")),
      course("x"),
      course("y", needs("x")),
    ]);
    const result = reconcileTrajectory(
      unmark("x"),
      plan,
      trajectory(["a", "x"], ["b", "y"]),
    );
    expect(ids(result.invalidations)).toEqual(["y"]);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toContain("b");
  });

  it("una trayectoria vacía no produce nada", () => {
    const plan = context([course("a")]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory([], []));
    expect(result.invalidations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("reconcileTrajectory — invalidación de IN_PROGRESS", () => {
  it("invalida el dependiente directo", () => {
    const plan = context([course("a"), course("b", needs("a"))]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory(["a"], ["b"]));
    expect(ids(result.invalidations)).toEqual(["b"]);
    expect(result.invalidations[0]?.depth).toBe(1);
    expect(result.invalidations[0]?.previousMark).toBe("IN_PROGRESS");
    expect(result.nextTrajectory.inProgressVersionCourseIds).toHaveLength(0);
  });

  it("propaga en cascada y registra la profundidad de cada ronda", () => {
    /* a -> b -> c -> d, con b, c y d en curso: al caer `a` solo `b` es
       inelegible en la primera ronda; `c` depende de `b` COMPLETED, que nunca
       lo estuvo, así que también cae de inmediato. */
    const plan = context([
      course("a"),
      course("b", needs("a")),
      course("c", needs("b")),
      course("d", needs("c")),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a"], ["b", "c", "d"]),
    );
    expect(ids(result.invalidations)).toEqual(["b", "c", "d"]);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toHaveLength(0);
  });

  it("invalida las dos ramas de una bifurcación", () => {
    const plan = context([
      course("a"),
      course("b", needs("a")),
      course("c", needs("a")),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a"], ["b", "c"]),
    );
    expect(ids(result.invalidations)).toEqual(["b", "c"]);
  });

  it("una reconvergencia ALL cae al perder cualquiera de sus ramas", () => {
    const plan = context([
      course("a"),
      course("b"),
      course("c", { type: "ALL", children: [needs("a"), needs("b")] }),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["c"]),
    );
    expect(ids(result.invalidations)).toEqual(["c"]);
  });
});

describe("reconcileTrajectory — expresiones con alternativas", () => {
  it("ANY sobrevive mientras quede una alternativa satisfecha", () => {
    const plan = context([
      course("a"),
      course("b"),
      course("c", { type: "ANY", children: [needs("a"), needs("b")] }),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["c"]),
    );
    expect(result.invalidations).toHaveLength(0);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toContain("c");
  });

  it("ANY cae solo cuando se pierde la última alternativa", () => {
    const plan = context([
      course("a"),
      course("b"),
      course("c", { type: "ANY", children: [needs("a"), needs("b")] }),
    ]);
    const result = reconcileTrajectory(unmark("b"), plan, trajectory(["b"], ["c"]));
    expect(ids(result.invalidations)).toEqual(["c"]);
  });

  it("AT_LEAST resiste por encima del umbral y cae al cruzarlo", () => {
    const plan = context([
      course("a"),
      course("b"),
      course("x"),
      course("c", {
        type: "AT_LEAST",
        threshold: 2,
        children: [needs("a"), needs("b"), needs("x")],
      }),
    ]);
    const above = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b", "x"], ["c"]),
    );
    expect(above.invalidations).toHaveLength(0);

    const crossing = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["c"]),
    );
    expect(ids(crossing.invalidations)).toEqual(["c"]);
  });
});

describe("reconcileTrajectory — correquisitos", () => {
  it("desmarcar el referenciado invalida al que lo exige concurrente", () => {
    const plan = context([course("a"), course("b", concurrent("a"))]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory([], ["a", "b"]));
    expect(ids(result.invalidations)).toEqual(["b"]);
  });

  it("pasar el referenciado de en curso a aprobado no invalida", () => {
    const plan = context([course("a"), course("b", concurrent("a"))]);
    const result = reconcileTrajectory(
      { versionCourseId: "a" as VersionCourseId, mark: "COMPLETED" },
      plan,
      trajectory([], ["a", "b"]),
    );
    expect(result.invalidations).toHaveLength(0);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toContain("b");
  });

  it("la relación es asimétrica: el referenciado no depende de quien lo exige", () => {
    const plan = context([course("a"), course("b", concurrent("a"))]);
    const result = reconcileTrajectory(unmark("b"), plan, trajectory([], ["a", "b"]));
    expect(result.invalidations).toHaveLength(0);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toContain("a");
  });
});

describe("reconcileTrajectory — requisitos por créditos", () => {
  /* Estos requisitos NO existen como aristas del grafo: un algoritmo que
     propagara solo por dependencias curso a curso los omitiría por completo. */
  it("invalida al cruzar hacia abajo un umbral de créditos totales", () => {
    const plan = context([
      course("a", undefined, 6),
      course("b", undefined, 6),
      course("gate", { type: "MIN_TOTAL_CREDITS", credits: 10 }),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["gate"]),
    );
    expect(ids(result.invalidations)).toEqual(["gate"]);
    expect(result.invalidations[0]?.blocking[0]?.type).toBe("MIN_TOTAL_CREDITS");
  });

  it("no invalida si tras el cambio el umbral se sigue alcanzando", () => {
    const plan = context([
      course("a", undefined, 6),
      course("b", undefined, 6),
      course("gate", { type: "MIN_TOTAL_CREDITS", credits: 6 }),
    ]);
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["gate"]),
    );
    expect(result.invalidations).toHaveLength(0);
  });

  it("un umbral por componente también reacciona", () => {
    const plan = context([
      course("a", undefined, 8),
      course("gate", {
        type: "MIN_COMPONENT_CREDITS",
        componentId,
        credits: 8,
      }),
    ]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory(["a"], ["gate"]));
    expect(ids(result.invalidations)).toEqual(["gate"]);
  });

  it("pasar una materia de aprobada a en curso reduce los créditos satisfechos", () => {
    /* Los créditos en curso no cuentan para un umbral: degradar COMPLETED a
       IN_PROGRESS basta para tumbar la materia que dependía de ellos. */
    const plan = context([
      course("a", undefined, 6),
      course("gate", { type: "MIN_TOTAL_CREDITS", credits: 6 }),
    ]);
    const result = reconcileTrajectory(
      { versionCourseId: "a" as VersionCourseId, mark: "IN_PROGRESS" },
      plan,
      trajectory(["a"], ["gate"]),
    );
    expect(ids(result.invalidations)).toEqual(["gate"]);
  });
});

describe("reconcileTrajectory — COMPLETED es historial", () => {
  it("nunca retira una materia aprobada, aunque pierda su requisito", () => {
    const plan = context([course("a"), course("b", needs("a"))]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory(["a", "b"], []));
    expect(result.invalidations).toHaveLength(0);
    expect(result.nextTrajectory.completedVersionCourseIds).toContain("b");
  });

  it("la reporta como advertencia con el requisito que falla", () => {
    const plan = context([course("a"), course("b", needs("a"))]);
    const result = reconcileTrajectory(unmark("a"), plan, trajectory(["a", "b"], []));
    expect(ids(result.warnings)).toEqual(["b"]);
    expect(result.warnings[0]?.mark).toBe("COMPLETED");
    expect(result.warnings[0]?.blocking[0]?.type).toBe("COURSE_COMPLETED");
  });

  it("no advierte sobre materias aprobadas que siguen siendo elegibles", () => {
    const plan = context([course("a"), course("b", needs("a"))]);
    const result = reconcileTrajectory(
      { versionCourseId: "c" as VersionCourseId, mark: "UNMARKED" },
      plan,
      trajectory(["a", "b"], []),
    );
    expect(result.warnings).toHaveLength(0);
  });

  it("una materia aprobada no se cuenta a sí misma para su propio umbral", () => {
    const plan = context([
      course("gate", { type: "MIN_TOTAL_CREDITS", credits: 3 }, 6),
    ]);
    const result = reconcileTrajectory(
      { versionCourseId: "otro" as VersionCourseId, mark: "UNMARKED" },
      plan,
      trajectory(["gate"], []),
    );
    expect(ids(result.warnings)).toEqual(["gate"]);
  });
});

describe("reconcileTrajectory — estados mixtos y propiedades", () => {
  const plan = context([
    course("a"),
    course("b", needs("a")),
    course("c", needs("b")),
    course("libre"),
  ]);

  it("combina aprobadas, en curso y sin marcar", () => {
    const result = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a", "b"], ["c", "libre"]),
    );
    /* `b` sigue aprobada pero se advierte; `c` la exigía COMPLETED, y lo sigue
       estando, así que no cae; `libre` no depende de nada. */
    expect(result.nextTrajectory.completedVersionCourseIds).toContain("b");
    expect(ids(result.warnings)).toEqual(["b"]);
    expect(result.invalidations).toHaveLength(0);
    expect(result.nextTrajectory.inProgressVersionCourseIds).toEqual(["c", "libre"]);
  });

  it("es idempotente sobre un resultado ya estable", () => {
    const first = reconcileTrajectory(unmark("a"), plan, trajectory(["a"], ["b", "c"]));
    const second = reconcileTrajectory(
      { versionCourseId: "libre" as VersionCourseId, mark: "UNMARKED" },
      plan,
      first.nextTrajectory,
    );
    expect(second.invalidations).toHaveLength(0);
    expect(second.nextTrajectory).toEqual(first.nextTrajectory);
  });

  it("aplicar el mismo cambio dos veces da el mismo resultado", () => {
    const once = reconcileTrajectory(unmark("a"), plan, trajectory(["a"], ["b"]));
    const twice = reconcileTrajectory(unmark("a"), plan, once.nextTrajectory);
    expect(twice.nextTrajectory).toEqual(once.nextTrajectory);
  });

  it("el resultado no depende del orden de la trayectoria", () => {
    const forward = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a"], ["b", "c"]),
    );
    const reversed = reconcileTrajectory(
      unmark("a"),
      plan,
      trajectory(["a"], ["c", "b"]),
    );
    expect([...forward.nextTrajectory.inProgressVersionCourseIds].sort()).toEqual(
      [...reversed.nextTrajectory.inProgressVersionCourseIds].sort(),
    );
    expect(ids(forward.invalidations)).toEqual(ids(reversed.invalidations));
  });

  it("no muta la trayectoria recibida", () => {
    const original = trajectory(["a"], ["b"]);
    reconcileTrajectory(unmark("a"), plan, original);
    expect(original.completedVersionCourseIds).toEqual(["a"]);
    expect(original.inProgressVersionCourseIds).toEqual(["b"]);
  });
});

describe("reconcileTrajectory — referencias no resolubles", () => {
  it("una referencia inexistente deja la materia inelegible y la retira", () => {
    /* El evaluador ya trata la referencia no resoluble como no satisfecha; la
       reconciliación se limita a respetar ese veredicto. */
    const plan = context([course("b", needs("fantasma"))]);
    const result = reconcileTrajectory(
      { versionCourseId: "otro" as VersionCourseId, mark: "UNMARKED" },
      plan,
      trajectory([], ["b"]),
    );
    expect(ids(result.invalidations)).toEqual(["b"]);
  });
});
