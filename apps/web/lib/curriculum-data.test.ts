import type {
  ComponentId,
  GroupingId,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import {
  calculateSatisfiedPlanProgress,
  type ComponentCreditProgress,
  type CreditProgress,
  type DerivedCourseState,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { describe, expect, it } from "vitest";
import {
  courseStateCounts,
  evaluationContext,
  planProgressProjection,
  progressBarPresentation,
  progressStageClass,
  satisfiedProgressBarArguments,
  unmodeledComponentsNote,
} from "./curriculum-data";

const groupingId = "grouping" as GroupingId;

function creditProgress(
  satisfiedCredits: number,
  projectedSatisfiedCredits: number,
): CreditProgress {
  return {
    rawCredits: 44,
    satisfiedCredits,
    excessCredits: 4,
    projectedSatisfiedCredits,
  };
}

describe("satisfiedProgressBarArguments", () => {
  it("presenta créditos satisfechos y no créditos raw", () => {
    const arguments_ = satisfiedProgressBarArguments(creditProgress(40, 40), 44);
    const presentation = progressBarPresentation(arguments_);

    expect(arguments_).toEqual({
      completedCredits: 40,
      requiredCredits: 44,
      completedRatio: 40 / 44,
      inProgressCredits: 0,
    });
    expect(presentation.completedPercent).toBe(91);
    expect(progressStageClass(presentation.completedPercent)).not.toBe(
      "progressStageMastered",
    );
    expect(arguments_).not.toHaveProperty("rawCredits");
    expect(arguments_).not.toHaveProperty("excessCredits");
  });

  it("calcula la contribución marginal satisfecha de materias en curso", () => {
    expect(
      satisfiedProgressBarArguments(creditProgress(32, 36), 44)
        .inProgressCredits,
    ).toBe(4);
    expect(
      satisfiedProgressBarArguments(creditProgress(44, 44), 44)
        .inProgressCredits,
    ).toBe(0);
  });
});

describe("planProgressProjection", () => {
  it("presenta los créditos proyectados que entrega el motor", () => {
    const progress = creditProgress(32, 36);

    expect(progress.projectedSatisfiedCredits).toBeGreaterThanOrEqual(
      progress.satisfiedCredits,
    );
    expect(
      planProgressProjection({
        satisfiedCredits: progress.satisfiedCredits,
        projectedSatisfiedCredits: progress.projectedSatisfiedCredits,
        requiredCredits: 44,
      }),
    ).toEqual({
      projectedCredits: 36,
      projectedPercent: 82,
      markerRatio: 36 / 44,
      text: "Proyectado si apruebas lo actual: 36/44 (82%)",
      ariaLabel:
        "Proyectado si apruebas lo actual: 36 de 44 créditos, 82%",
    });
  });

  it("omite la proyección cuando no agrega créditos satisfechos", () => {
    expect(
      planProgressProjection({
        satisfiedCredits: 40,
        projectedSatisfiedCredits: 40,
        requiredCredits: 44,
      }),
    ).toBeUndefined();
  });

  it("capa el marcador al 100% sin truncar el valor textual", () => {
    const projection = planProgressProjection({
      satisfiedCredits: 40,
      projectedSatisfiedCredits: 48,
      requiredCredits: 44,
    });

    expect(projection?.markerRatio).toBe(1);
    expect(projection?.projectedCredits).toBe(48);
    expect(projection?.text).toBe(
      "Proyectado si apruebas lo actual: 48/44 (109%)",
    );
  });

  it("no estima créditos de componentes sin agrupaciones", () => {
    const progress = calculateSatisfiedPlanProgress(
      evaluationContext,
      { completedVersionCourseIds: [], inProgressVersionCourseIds: [] },
      unalCs2024Official.planVersion.requiredCredits,
    );
    const unmodeled = progress.components.find(
      (componentProgress) => componentProgress.groupings.length === 0,
    );

    expect(unmodeled?.satisfiedCredits).toBe(0);
    expect(unmodeled?.projectedSatisfiedCredits).toBe(0);
    expect(
      planProgressProjection({
        satisfiedCredits: unmodeled?.satisfiedCredits ?? 0,
        projectedSatisfiedCredits:
          unmodeled?.projectedSatisfiedCredits ?? 0,
        requiredCredits: unmodeled?.requiredCredits ?? 0,
      }),
    ).toBeUndefined();
  });
});

describe("courseStateCounts", () => {
  it("cuenta estados y deriva el total del mapa", () => {
    const states = new Map<VersionCourseId, DerivedCourseState>([
      ["completed-a" as VersionCourseId, "COMPLETED"],
      ["completed-b" as VersionCourseId, "COMPLETED"],
      ["available" as VersionCourseId, "AVAILABLE"],
      ["blocked" as VersionCourseId, "BLOCKED"],
      ["in-progress" as VersionCourseId, "IN_PROGRESS"],
    ]);

    expect(courseStateCounts(states)).toEqual({
      completed: 2,
      available: 1,
      total: states.size,
      text: "2 de 5 materias aprobadas · 1 disponibles ahora",
    });
  });

  it("representa un mapa vacío sin excepción", () => {
    expect(courseStateCounts(new Map())).toEqual({
      completed: 0,
      available: 0,
      total: 0,
      text: "0 de 0 materias aprobadas · 0 disponibles ahora",
    });
  });
});

describe("progressStageClass", () => {
  it("reserva la etapa dominada para el requisito satisfecho", () => {
    expect(progressStageClass(91)).toBe("progressStageViolet");
    expect(progressStageClass(100)).toBe("progressStageMastered");
  });
});

const component = (
  id: string,
  requiredCredits: number,
  groupings: ComponentCreditProgress["groupings"],
): ComponentCreditProgress => ({
  componentId: id as ComponentId,
  requiredCredits,
  groupings,
  ...creditProgress(0, 0),
});
const modeledGrouping = {
  groupingId,
  requiredCredits: 10,
  ...creditProgress(0, 0),
};

describe("unmodeledComponentsNote", () => {
  it("describe un componente sin modelar con su nombre", () => {
    const note = unmodeledComponentsNote(
      [component("free-choice", 29, [])],
      () => "Libre Elección",
    );

    expect(note).toEqual({
      credits: 29,
      names: ["Libre Elección"],
      text: "29 créditos aún no modelados en Sidera (Libre Elección).",
    });
  });

  it("lista todos los nombres y suma sus créditos", () => {
    const names = new Map([
      ["unmodeled-a", "Componente A"],
      ["unmodeled-b", "Componente B"],
      ["unmodeled-c", "Componente C"],
    ]);
    const note = unmodeledComponentsNote(
      [
        component("modeled", 10, [modeledGrouping]),
        component("unmodeled-a", 10, []),
        component("unmodeled-b", 12, []),
        component("unmodeled-c", 7, []),
      ],
      (id) => names.get(id),
    );

    expect(note?.credits).toBe(29);
    expect(note?.names).toEqual([
      "Componente A",
      "Componente B",
      "Componente C",
    ]);
    expect(note?.text).toBe(
      "29 créditos aún no modelados en Sidera (Componente A, Componente B y Componente C).",
    );
  });

  it("no genera nota cuando todos los componentes tienen agrupaciones", () => {
    expect(
      unmodeledComponentsNote([component("modeled", 10, [modeledGrouping])]),
    ).toBeUndefined();
  });

  it("ignora componentes sin agrupaciones que no exigen créditos", () => {
    expect(
      unmodeledComponentsNote([component("empty", 0, [])]),
    ).toBeUndefined();
  });

  it("conserva los créditos y usa un descriptor neutro si falta el nombre", () => {
    expect(
      unmodeledComponentsNote(
        [component("known", 20, []), component("unknown", 9, [])],
        (id) => (id === ("known" as ComponentId) ? "Componente conocido" : undefined),
      ),
    ).toEqual({
      credits: 29,
      names: ["Componente conocido", "el componente indicado"],
      text: "29 créditos aún no modelados en Sidera (Componente conocido y el componente indicado).",
    });
  });

  it("deriva los créditos y el nombre del dataset oficial", () => {
    const progress = calculateSatisfiedPlanProgress(
      evaluationContext,
      { completedVersionCourseIds: [], inProgressVersionCourseIds: [] },
      unalCs2024Official.planVersion.requiredCredits,
    );

    const expectedComponent = unalCs2024Official.components.find(
      (component) =>
        component.requiredCredits > 0 &&
        !unalCs2024Official.groupings.some(
          (grouping) => grouping.componentId === component.id,
        ),
    );
    const note = unmodeledComponentsNote(progress.components);

    expect(note?.credits).toBe(29);
    expect(note?.names).toEqual([expectedComponent?.name]);
    expect(note?.text).toBe(
      `29 créditos aún no modelados en Sidera (${expectedComponent?.name}).`,
    );
  });
});

describe("progressBarPresentation", () => {
  it("mantiene el porcentaje aprobado separado de los créditos en curso", () => {
    const presentation = progressBarPresentation({
      completedCredits: 32,
      requiredCredits: 44,
      completedRatio: 32 / 44,
      inProgressCredits: 4,
    });

    expect(presentation.completedPercent).toBe(73);
    expect(presentation.inProgressRatio).toBeCloseTo(4 / 44);
    expect(presentation.completedText).toBe("32 / 44 créditos · 73%");
    expect(presentation.inProgressText).toBe("+4 créditos en curso");
  });

  it("recorta a cero el segmento en curso al 100% sin ocultar su valor real", () => {
    const presentation = progressBarPresentation({
      completedCredits: 48,
      requiredCredits: 44,
      completedRatio: 1,
      inProgressCredits: 4,
    });

    expect(presentation.completedRatio).toBe(1);
    expect(presentation.inProgressRatio).toBe(0);
    expect(presentation.completedText).toBe("48 / 44 créditos · 100%");
    expect(presentation.inProgressText).toBe("+4 créditos en curso");
  });

  it("representa un alcance vacío sin segmento ni texto en curso", () => {
    const presentation = progressBarPresentation({
      completedCredits: 0,
      requiredCredits: 44,
      completedRatio: 0,
      inProgressCredits: 0,
    });

    expect(presentation.completedRatio).toBe(0);
    expect(presentation.inProgressRatio).toBe(0);
    expect(presentation.inProgressText).toBeUndefined();
  });
});
