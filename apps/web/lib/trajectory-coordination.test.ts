import type { VersionCourseId } from "@sidera/curriculum-domain";
import {
  reconcileTrajectory,
  type StudentTrajectory,
  type TrajectoryReconciliation,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { describe, expect, it } from "vitest";
import { evaluationContext } from "./curriculum-data";
import { groupImpacts } from "./trajectory-impact-groups";
import type { Mark } from "./trajectory";

/* Reproduce la coordinación que hace `TrajectoryProvider` sin montar React:
   previsualiza, decide si hay que confirmar y aplica solo entonces. La regla
   que se prueba aquí es la del provider —cuándo se aplica y qué se aplica—, no
   la aritmética curricular, que ya cubren los tests del engine. */
function createCoordinator(initial: StudentTrajectory) {
  let trajectory = initial;
  let pending: TrajectoryReconciliation | null = null;

  return {
    get trajectory() {
      return trajectory;
    },
    get pending() {
      return pending;
    },
    mark(versionCourseId: VersionCourseId, mark: Mark) {
      const reconciliation = reconcileTrajectory(
        { versionCourseId, mark },
        evaluationContext,
        trajectory,
      );
      /* Mismo criterio que el provider: solo detiene el cambio si RETIRA
         materias en curso. Las advertencias históricas no interrumpen. */
      if (reconciliation.invalidations.length === 0) {
        trajectory = reconciliation.nextTrajectory;
        return reconciliation;
      }
      pending = reconciliation;
      return reconciliation;
    },
    confirm() {
      if (!pending) return;
      trajectory = pending.nextTrajectory;
      pending = null;
    },
    cancel() {
      pending = null;
    },
  };
}

const named = (name: string): VersionCourseId => {
  const course = unalCs2024Official.courses.find((item) => item.name === name);
  const versionCourse = unalCs2024Official.versionCourses.find(
    (item) => item.courseId === course?.id,
  );
  if (!versionCourse) throw new Error(`Materia no encontrada: ${name}`);
  return versionCourse.id;
};

/* Datos reales del plan: Cálculo integral exige Cálculo diferencial aprobada. */
const calcDiferencial = named("Cálculo diferencial");
const calcIntegral = named("Cálculo integral");

const empty: StudentTrajectory = {
  completedVersionCourseIds: [],
  inProgressVersionCourseIds: [],
};

describe("coordinación de cambios sin impacto", () => {
  it("aplica al instante y no deja nada pendiente", () => {
    const coordinator = createCoordinator(empty);
    coordinator.mark(calcDiferencial, "COMPLETED");

    expect(coordinator.pending).toBeNull();
    expect(coordinator.trajectory.completedVersionCourseIds).toContain(
      calcDiferencial,
    );
  });

  it("marcar en curso una materia disponible tampoco pide confirmación", () => {
    const coordinator = createCoordinator(empty);
    coordinator.mark(calcDiferencial, "IN_PROGRESS");

    expect(coordinator.pending).toBeNull();
    expect(coordinator.trajectory.inProgressVersionCourseIds).toContain(
      calcDiferencial,
    );
  });
});

describe("coordinación con invalidaciones", () => {
  const started: StudentTrajectory = {
    completedVersionCourseIds: [calcDiferencial],
    inProgressVersionCourseIds: [calcIntegral],
  };

  it("previsualizar no muta la trayectoria", () => {
    const coordinator = createCoordinator(started);
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");

    expect(preview.invalidations.length).toBeGreaterThan(0);
    expect(coordinator.trajectory).toEqual(started);
  });

  it("cancelar no cambia absolutamente nada", () => {
    const coordinator = createCoordinator(started);
    coordinator.mark(calcDiferencial, "UNMARKED");
    coordinator.cancel();

    expect(coordinator.pending).toBeNull();
    expect(coordinator.trajectory).toEqual(started);
  });

  it("confirmar aplica exactamente el resultado previsualizado", () => {
    const coordinator = createCoordinator(started);
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    coordinator.confirm();

    /* Igualdad con el objeto del preview: es la garantía de que lo aplicado es
       lo que se mostró, no un recálculo posterior. */
    expect(coordinator.trajectory).toEqual(preview.nextTrajectory);
    expect(coordinator.trajectory.inProgressVersionCourseIds).not.toContain(
      calcIntegral,
    );
    expect(coordinator.pending).toBeNull();
  });
});

describe("coordinación con advertencias de historial", () => {
  const withHistory: StudentTrajectory = {
    completedVersionCourseIds: [calcDiferencial, calcIntegral],
    inProgressVersionCourseIds: [],
  };

  it("no pide confirmación si solo genera advertencias históricas", () => {
    /* Nada se retira, así que no hay decisión que tomar: interrumpir sería
       fricción sin propósito. */
    const coordinator = createCoordinator(withHistory);
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");

    expect(preview.invalidations).toHaveLength(0);
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(coordinator.pending).toBeNull();
  });

  it("aplica el cambio de inmediato pese a las advertencias", () => {
    const coordinator = createCoordinator(withHistory);
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");

    expect(coordinator.trajectory).toEqual(preview.nextTrajectory);
    expect(coordinator.trajectory.completedVersionCourseIds).not.toContain(
      calcDiferencial,
    );
  });

  it("las materias aprobadas siguen aprobadas tras aplicar", () => {
    /* La política de dominio es historial: la incoherencia se detecta, pero la
       materia no se retira. */
    const coordinator = createCoordinator(withHistory);
    coordinator.mark(calcDiferencial, "UNMARKED");

    expect(coordinator.trajectory.completedVersionCourseIds).toContain(
      calcIntegral,
    );
  });
});

describe("coordinación con impacto mixto", () => {
  it("acumula invalidaciones y advertencias en la misma confirmación", () => {
    /* Cálculo diferencial tiene varios dependientes reales: dejando uno
       aprobado y otro en curso, el mismo cambio produce a la vez una
       advertencia de historial y una invalidación. */
    const fisica = named("Física mecánica");
    const mixed: StudentTrajectory = {
      completedVersionCourseIds: [calcDiferencial, calcIntegral],
      inProgressVersionCourseIds: [fisica],
    };
    const coordinator = createCoordinator(mixed);
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");

    expect(preview.invalidations.length).toBeGreaterThan(0);
    expect(preview.warnings.length).toBeGreaterThan(0);
    /* Se detiene por las invalidaciones; las advertencias solo acompañan. */
    expect(coordinator.pending).not.toBeNull();
    expect(coordinator.trajectory).toEqual(mixed);

    coordinator.confirm();
    expect(coordinator.trajectory).toEqual(preview.nextTrajectory);
  });

  it("el diálogo no presenta las advertencias históricas", () => {
    const mixed: StudentTrajectory = {
      completedVersionCourseIds: [calcDiferencial, calcIntegral],
      inProgressVersionCourseIds: [named("Física mecánica")],
    };
    const preview = createCoordinator(mixed).mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    /* El engine las sigue calculando, pero ninguna llega a la vista. */
    expect(preview.warnings.length).toBeGreaterThan(0);
    const shown = [...groups.direct, ...groups.cascade].map((item) => item.id);
    for (const warning of preview.warnings) {
      expect(shown).not.toContain(String(warning.versionCourseId));
    }
  });
});

describe("coordinación ante repeticiones", () => {
  it("repetir el mismo cambio tras confirmarlo no produce impacto nuevo", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [calcIntegral],
    });
    coordinator.mark(calcDiferencial, "UNMARKED");
    coordinator.confirm();
    const settled = coordinator.trajectory;

    coordinator.mark(calcDiferencial, "UNMARKED");
    expect(coordinator.pending).toBeNull();
    expect(coordinator.trajectory).toEqual(settled);
  });

  it("cancelar y reintentar produce el mismo impacto", () => {
    const started: StudentTrajectory = {
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [calcIntegral],
    };
    const coordinator = createCoordinator(started);
    const first = coordinator.mark(calcDiferencial, "UNMARKED");
    coordinator.cancel();
    const second = coordinator.mark(calcDiferencial, "UNMARKED");

    expect(second.nextTrajectory).toEqual(first.nextTrajectory);
    expect(second.invalidations.map((item) => item.versionCourseId)).toEqual(
      first.invalidations.map((item) => item.versionCourseId),
    );
  });
});

describe("presentación del impacto en el diálogo", () => {
  const fisica = named("Física mecánica");

  it("muestra el cambio solicitado con nombre y marca legibles", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [calcIntegral],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    expect(groups.requestedName).toContain("Cálculo diferencial");
    expect(groups.requestedMark).toBe("Sin marcar");
  });

  it("traduce cada marca a su etiqueta visible", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial, calcIntegral],
      inProgressVersionCourseIds: [],
    });
    const preview = coordinator.mark(calcDiferencial, "IN_PROGRESS");
    expect(groupImpacts(preview).requestedMark).toBe("En curso");
  });

  it("separa el impacto directo de la cascada por profundidad", () => {
    /* Cadena real: Cálculo diferencial -> Cálculo integral -> Cálculo en
       varias variables. Al desmarcar la primera, la segunda cae en la ronda 1
       y la tercera en una posterior. */
    const calcVarias = named("Cálculo en varias variables");
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [calcIntegral, calcVarias],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    expect(groups.direct.every((item) => item.depth === 1)).toBe(true);
    expect(groups.cascade.every((item) => item.depth > 1)).toBe(true);
    expect(groups.direct.length + groups.cascade.length).toBe(
      preview.invalidations.length,
    );
  });

  it("solo agrupa invalidaciones, nunca advertencias", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial, calcIntegral],
      inProgressVersionCourseIds: [fisica],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    expect(groups.direct.length + groups.cascade.length).toBe(
      preview.invalidations.length,
    );
  });

  it("los conteos coinciden con lo que calculó el engine", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial, calcIntegral],
      inProgressVersionCourseIds: [fisica],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    expect(groups.direct.length + groups.cascade.length).toBe(
      preview.invalidations.length,
    );
  });

  it("ordena por profundidad y, dentro de cada nivel, de forma estable", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [
        calcIntegral,
        fisica,
        named("Fundamentos de análisis"),
      ],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);
    const all = [...groups.direct, ...groups.cascade];

    for (let index = 1; index < all.length; index += 1) {
      const previous = all[index - 1]!;
      const current = all[index]!;
      expect(previous.depth).toBeLessThanOrEqual(current.depth);
      if (previous.depth === current.depth) {
        expect(previous.name.localeCompare(current.name, "es")).toBeLessThan(0);
      }
    }
  });

  it("el orden no depende del orden de la trayectoria de entrada", () => {
    const inProgress = [calcIntegral, fisica, named("Fundamentos de análisis")];
    const forward = groupImpacts(
      createCoordinator({
        completedVersionCourseIds: [calcDiferencial],
        inProgressVersionCourseIds: inProgress,
      }).mark(calcDiferencial, "UNMARKED"),
    );
    const reversed = groupImpacts(
      createCoordinator({
        completedVersionCourseIds: [calcDiferencial],
        inProgressVersionCourseIds: [...inProgress].reverse(),
      }).mark(calcDiferencial, "UNMARKED"),
    );

    expect(forward.direct.map((item) => item.id)).toEqual(
      reversed.direct.map((item) => item.id),
    );
    expect(forward.cascade.map((item) => item.id)).toEqual(
      reversed.cascade.map((item) => item.id),
    );
  });

  it("cada impacto lleva su razón académica, no una frase genérica", () => {
    const coordinator = createCoordinator({
      completedVersionCourseIds: [calcDiferencial],
      inProgressVersionCourseIds: [calcIntegral],
    });
    const preview = coordinator.mark(calcDiferencial, "UNMARKED");
    const groups = groupImpacts(preview);

    expect(groups.direct[0]?.reasons.length).toBeGreaterThan(0);
    expect(groups.direct[0]?.reasons.join(" ")).toContain("Cálculo diferencial");
  });

  it("sin impacto no hay nada que agrupar", () => {
    const coordinator = createCoordinator(empty);
    const preview = coordinator.mark(calcDiferencial, "COMPLETED");
    const groups = groupImpacts(preview);

    expect(groups.direct).toHaveLength(0);
    expect(groups.cascade).toHaveLength(0);
  });
});
