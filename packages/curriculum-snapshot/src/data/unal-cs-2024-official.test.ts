import { describe, expect, it } from "vitest";
import type { RequirementExpression, VersionCourseId } from "@sidera/curriculum-domain";
import {
  academicProgramSchema,
  componentSchema,
  courseSchema,
  curriculumPlanSchema,
  groupingSchema,
  planVersionSchema,
  universitySchema,
  versionCourseSchema,
} from "@sidera/curriculum-schema";
import { unalCs2024Official } from "./unal-cs-2024-official/index.js";

const referencedVersionCourseIds = (
  requirement: RequirementExpression,
): VersionCourseId[] => {
  if (
    requirement.type === "COURSE_COMPLETED" ||
    requirement.type === "COURSE_COMPLETED_OR_CONCURRENT"
  ) {
    return [requirement.versionCourseId];
  }
  if (requirement.type === "ALL" || requirement.type === "ANY" || requirement.type === "AT_LEAST") {
    return requirement.children.flatMap(referencedVersionCourseIds);
  }
  return [];
};

describe("UNAL Ciencias de la Computación, Acuerdo 0018 de 2024", () => {
  it("valida todas las entidades contra sus schemas", () => {
    expect(universitySchema.safeParse(unalCs2024Official.university).success).toBe(true);
    expect(academicProgramSchema.safeParse(unalCs2024Official.academicProgram).success).toBe(true);
    expect(curriculumPlanSchema.safeParse(unalCs2024Official.curriculumPlan).success).toBe(true);
    expect(planVersionSchema.safeParse(unalCs2024Official.planVersion).success).toBe(true);

    for (const component of unalCs2024Official.components) {
      expect(componentSchema.safeParse(component).success).toBe(true);
    }
    for (const grouping of unalCs2024Official.groupings) {
      expect(groupingSchema.safeParse(grouping).success).toBe(true);
    }
    for (const course of unalCs2024Official.courses) {
      expect(courseSchema.safeParse(course).success).toBe(true);
    }
    for (const versionCourse of unalCs2024Official.versionCourses) {
      expect(versionCourseSchema.safeParse(versionCourse).success).toBe(true);
    }
  });

  it("conserva la estructura y los créditos exigidos declarados", () => {
    expect(unalCs2024Official.components).toHaveLength(3);
    expect(unalCs2024Official.groupings).toHaveLength(8);
    expect(unalCs2024Official.courses).toHaveLength(60);
    expect(unalCs2024Official.versionCourses).toHaveLength(60);

    expect(
      Object.fromEntries(unalCs2024Official.components.map(({ name, requiredCredits }) => [name, requiredCredits])),
    ).toEqual({
      "Componente de Fundamentación": 61,
      "Componente de Formación Disciplinar o Profesional": 56,
      "Componente de Libre Elección": 29,
    });
    expect(
      Object.fromEntries(unalCs2024Official.groupings.map(({ name, requiredCredits }) => [name, requiredCredits])),
    ).toEqual({
      Matemáticas: 44,
      Programación: 9,
      "Ciencias Naturales y Estadística": 8,
      "Algoritmos y Computación": 19,
      "Computación Científica": 16,
      "Sistemas de Cómputo": 6,
      "Computación Aplicada": 7,
      "Trabajo de Grado": 8,
    });
  });

  it("modela Trabajo de grado y excluye Cursos de posgrado", () => {
    const degreeWork = unalCs2024Official.versionCourses.find(
      ({ academicCode }) => academicCode === "3010664",
    );

    expect(degreeWork?.requirements).toEqual({
      type: "MIN_COMPONENT_CREDITS",
      componentId: unalCs2024Official.components[1]?.id,
      credits: 34,
    });
    expect(
      unalCs2024Official.versionCourses.some(({ academicCode }) => academicCode === "3010665"),
    ).toBe(false);
  });

  it("no contiene referencias VersionCourseId colgantes", () => {
    const existingIds = new Set(unalCs2024Official.versionCourses.map(({ id }) => id));
    const referencedIds = unalCs2024Official.versionCourses.flatMap(({ requirements }) =>
      requirements === undefined ? [] : referencedVersionCourseIds(requirements),
    );

    for (const referencedId of referencedIds) expect(existingIds.has(referencedId)).toBe(true);
  });
});
