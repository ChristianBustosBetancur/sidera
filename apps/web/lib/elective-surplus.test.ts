import { describe, expect, it } from "vitest";
import type { VersionCourseId } from "@sidera/curriculum-domain";
import { programs } from "./programs";
import { electivesFullNote, freeChoiceOrigins, groupingElectiveStates, originNote, surplusNote } from "./elective-surplus";

const computing = programs[0]!;
const mathematics = programs[1]!;
const idOf = (program: typeof computing, code: string) =>
  program.snapshot.versionCourses.find(course => course.academicCode === code)!.id;
const trajectory = (program: typeof computing, completed: readonly string[], inProgress: readonly string[] = []) => ({
  completedVersionCourseIds: completed.map(code => idOf(program, code)),
  inProgressVersionCourseIds: inProgress.map(code => idOf(program, code)),
});
const applied = mathematics.snapshot.groupings.find(grouping => grouping.id.endsWith("-applied"))!;
const csMathematics = computing.snapshot.groupings.find(grouping => grouping.id.endsWith("-mathematics"))!;
const stateFor = (program: typeof computing, groupingId: string, completed: readonly string[], inProgress: readonly string[] = []) =>
  groupingElectiveStates(program.evaluationContext, trajectory(program, completed, inProgress)).get(groupingId as never)!;

/* Matemática Aplicada: 8 requeridos, una obligatoria de 4, cupo optativo 4. */
describe("excedente agregado por agrupación", () => {
  it("no hay excedente mientras quede cupo", () => {
    const state = stateFor(mathematics, applied.id, ["3006909"]);
    expect(state).toMatchObject({ capacity: 4, approvedSurplus: 0, inProgressSurplus: 0, electivesFull: true });
    expect(surplusNote(state)).toBeUndefined();
  });

  it("cuenta los créditos que sobran, sin señalar asignatura", () => {
    const state = stateFor(mathematics, applied.id, ["3006909", "3006884"]);
    expect(state.approvedSurplus).toBe(4);
    expect(state.approvedElectives).toBe(2);
    expect(surplusNote(state)).toBe("+4 créditos excedentes");
    // El estado no expone ninguna lista de «perdedoras».
    expect(Object.keys(state)).not.toContain("surplus");
  });

  it("distingue el excedente aprobado del que está en curso", () => {
    const state = stateFor(mathematics, applied.id, ["3006884"], ["3008082"]);
    expect(state).toMatchObject({ approvedSurplus: 0, inProgressSurplus: 4, inProgressElectives: 1 });
    expect(surplusNote(state)).toBe("+4 créditos excedentes en curso");
    const ambos = stateFor(mathematics, applied.id, ["3006909", "3006884"], ["3008082"]);
    expect(surplusNote(ambos)).toBe("+4 créditos excedentes · +4 créditos excedentes en curso");
  });

  it("nombra la obligatoria que falta cuando el cupo está lleno", () => {
    const state = stateFor(mathematics, applied.id, ["3006909", "3006884"]);
    expect(electivesFullNote(state, mathematics.courseReference))
      .toBe("Optativas completas · falta 3006886 Análisis numérico");
    expect(electivesFullNote(stateFor(mathematics, applied.id, []), mathematics.courseReference)).toBeUndefined();
  });

  /* Regresión del caso reportado: en Computación la agrupación Matemáticas
     tiene cupo optativo 4 y seis optativas de 4 créditos, así que solo una
     cabe. Completar una segunda no debe reetiquetar a la primera. */
  describe("Matemáticas Especiales y Teoría de Grafos", () => {
    const base = ["3010334", "3010390"];

    it("una sola optativa aprobada no genera excedente", () => {
      const state = stateFor(computing, csMathematics.id, [...base, "3006905"]);
      expect(state).toMatchObject({ capacity: 4, approvedSurplus: 0, approvedElectives: 1 });
    });

    it("al aprobar la segunda, el excedente son créditos y ninguna materia cambia de etiqueta", () => {
      const state = stateFor(computing, csMathematics.id, [...base, "3006905", "3006900"]);
      expect(state).toMatchObject({ approvedSurplus: 4, approvedElectives: 2 });
      expect(surplusNote(state)).toBe("+4 créditos excedentes");
      // Da igual en qué orden aparezcan: el resultado es el mismo conjunto.
      expect(stateFor(computing, csMathematics.id, [...base, "3006900", "3006905"])).toEqual(state);
    });

    it("el desglose de Libre Elección nombra la agrupación, no la asignatura", () => {
      const origins = freeChoiceOrigins(computing.evaluationContext, trajectory(computing, [...base, "3006905", "3006900"]));
      expect(origins).toHaveLength(1);
      expect(origins[0]!.groupingId).toBe(csMathematics.id);
      expect(originNote(origins[0]!)).toBe("4 créditos excedentes de 2 optativas aprobadas");
      expect(origins[0]!.approvedElectives).toBe(2);
      // Ninguna propiedad del desglose identifica una materia concreta.
      expect(JSON.stringify(origins)).not.toContain("3006905");
      expect(JSON.stringify(origins)).not.toContain("3006900");
    });

    it("al desmarcar la segunda vuelve a no haber excedente", () => {
      const state = stateFor(computing, csMathematics.id, [...base, "3006905"]);
      expect(state.approvedSurplus).toBe(0);
      expect(freeChoiceOrigins(computing.evaluationContext, trajectory(computing, [...base, "3006905"]))).toEqual([]);
    });
  });

  it("con créditos fraccionados habla de créditos, no de materias trasladadas", () => {
    /* Algoritmos y Computación: 19 requeridos, 12 obligatorios, cupo 7. Dos
       optativas de 4 dejan 1 crédito de excedente, no una asignatura entera. */
    const algorithms = computing.snapshot.groupings.find(grouping => grouping.id.endsWith("-algorithms-computing"))!;
    const electives = computing.snapshot.versionCourses
      .filter(course => course.groupingId === algorithms.id && !course.mandatory && course.credits === 4)
      .slice(0, 2);
    expect(electives).toHaveLength(2);
    const states = groupingElectiveStates(computing.evaluationContext, {
      completedVersionCourseIds: electives.map(course => course.id as VersionCourseId),
      inProgressVersionCourseIds: [],
    });
    const state = states.get(algorithms.id)!;
    expect(state.capacity).toBe(7);
    expect(state.approvedSurplus).toBe(1);
    expect(surplusNote(state)).toBe("+1 crédito excedente");
    expect(originNote(freeChoiceOrigins(computing.evaluationContext, {
      completedVersionCourseIds: electives.map(course => course.id as VersionCourseId),
      inProgressVersionCourseIds: [],
    })[0]!)).toBe("1 crédito excedente de 2 optativas aprobadas");
  });
});
