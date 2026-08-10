import type {
  ComponentId,
  GroupingId,
} from "@sidera/curriculum-domain";
import {
  calculateSatisfiedPlanProgress,
  type ComponentCreditProgress,
  type CreditProgress,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { describe, expect, it } from "vitest";
import {
  evaluationContext,
  progressBarPresentation,
  progressStageClass,
  satisfiedProgressBarArguments,
  unmodeledComponentRequiredCredits,
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

describe("progressStageClass", () => {
  it("reserva la etapa dominada para el requisito satisfecho", () => {
    expect(progressStageClass(91)).toBe("progressStageViolet");
    expect(progressStageClass(100)).toBe("progressStageMastered");
  });
});

describe("unmodeledComponentRequiredCredits", () => {
  it("suma únicamente componentes sin agrupaciones modeladas", () => {
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

    expect(
      unmodeledComponentRequiredCredits([
        component("modeled", 10, [modeledGrouping]),
        component("unmodeled-a", 20, []),
        component("unmodeled-b", 9, []),
      ]),
    ).toBe(29);
  });

  it("deriva 29 créditos del dataset oficial", () => {
    const progress = calculateSatisfiedPlanProgress(
      evaluationContext,
      { completedVersionCourseIds: [], inProgressVersionCourseIds: [] },
      unalCs2024Official.planVersion.requiredCredits,
    );

    expect(unmodeledComponentRequiredCredits(progress.components)).toBe(29);
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
