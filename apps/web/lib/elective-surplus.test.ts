import { describe, expect, it } from "vitest";
import type { VersionCourseId } from "@sidera/curriculum-domain";
import { calculateSatisfiedPlanProgress, previewAcademicMark, recordContext, recordTrajectory, programRecord } from "@sidera/curriculum-engine";
import { emptyAcademicRecords } from "./academic-storage";
import { programs, programModels, verifiedShared } from "./programs";
import { electiveSurplus, electivesFullNote, surplusNote } from "./elective-surplus";

const mathematics = programs[1]!;
const applied = mathematics.snapshot.groupings.find(grouping => grouping.id.endsWith("-applied"))!;
const appliedCourses = mathematics.snapshot.versionCourses.filter(course => course.groupingId === applied.id);
const byCode = (code: string) => appliedCourses.find(course => course.academicCode === code)!;
const ids = (codes: readonly string[]) => new Set<VersionCourseId>(codes.map(code => byCode(code).id));
const surplusOf = (completed: readonly string[], inProgress: readonly string[] = []) =>
  electiveSurplus({ courses: appliedCourses, requiredCredits: applied.requiredCredits, completed: ids(completed), inProgress: ids(inProgress) });

/* Matemática Aplicada: 8 requeridos, una obligatoria de 4 (3006886 Análisis
   numérico) y optativas de 4, de modo que el cupo optativo es de 4 créditos. */
describe("excedente de optativas", () => {
  it("deriva el cupo de los requeridos menos las obligatorias", () => {
    expect(surplusOf([]).capacity).toBe(4);
    expect(surplusOf([]).electivesFull).toBe(false);
    expect(surplusOf([]).surplusCredits).toBe(0);
  });

  it("una sola optativa llena el cupo y no sobra nada", () => {
    const result = surplusOf(["3006909"]);
    expect(result.surplus).toEqual([]);
    expect(result.surplusCredits).toBe(0);
    expect(result.electivesFull).toBe(true);
  });

  it("la segunda optativa queda como excedente, por código y no por orden de marca", () => {
    const result = surplusOf(["3006909", "3006884"]);
    // 3006884 va antes que 3006909 por código: la que sobra es la segunda.
    expect(result.surplus).toEqual([byCode("3006909").id]);
    expect(result.surplusCredits).toBe(4);
    // El mismo conjunto marcado al revés produce exactamente el mismo resultado.
    expect(surplusOf(["3006884", "3006909"]).surplus).toEqual(result.surplus);
  });

  it("las Completadas consumen el cupo antes que las En curso", () => {
    const result = surplusOf(["3006884"], ["3008082"]);
    expect(result.surplus).toEqual([byCode("3008082").id]);
    expect(result.surplusCredits).toBe(4);
  });

  it("coincide con el excedente que calcula el motor", () => {
    let records = emptyAcademicRecords();
    for (const code of ["3006909", "3006884"]) {
      records = previewAcademicMark(records, programModels, verifiedShared, "mathematics", byCode(code).courseId, "COMPLETED").next;
    }
    const record = programRecord(records, programModels[1]!);
    const progress = calculateSatisfiedPlanProgress(
      recordContext(record, mathematics.evaluationContext),
      recordTrajectory(record, mathematics.evaluationContext),
      mathematics.snapshot.planVersion.requiredCredits,
    );
    const group = progress.components.flatMap(component => component.groupings).find(entry => entry.groupingId === applied.id)!;
    expect(group.excessCredits).toBe(surplusOf(["3006909", "3006884"]).surplusCredits);
    expect(group.satisfiedCredits).toBe(4);
  });

  it("nombra la obligatoria que falta cuando el cupo ya está lleno", () => {
    const result = surplusOf(["3006909", "3006884"]);
    expect(result.missingMandatory).toEqual([byCode("3006886").id]);
    expect(electivesFullNote(result, mathematics.courseReference))
      .toBe("Optativas completas · falta 3006886 Análisis numérico");
    expect(surplusNote(result)).toBe("+4 créditos excedentes");
  });

  it("calla cuando el cupo no está lleno o la obligatoria ya está aprobada", () => {
    expect(electivesFullNote(surplusOf(["3006909"]), mathematics.courseReference))
      .toBe("Optativas completas · falta 3006886 Análisis numérico");
    expect(electivesFullNote(surplusOf([]), mathematics.courseReference)).toBeUndefined();
    expect(electivesFullNote(surplusOf(["3006909", "3006886"]), mathematics.courseReference)).toBeUndefined();
    expect(surplusNote(surplusOf([]))).toBeUndefined();
  });

  it("no inventa excedente en una agrupación sin optativas", () => {
    const degree = mathematics.snapshot.groupings.find(grouping => grouping.id.endsWith("-degree"))!;
    const courses = mathematics.snapshot.versionCourses.filter(course => course.groupingId === degree.id);
    const result = electiveSurplus({ courses, requiredCredits: degree.requiredCredits, completed: new Set(), inProgress: new Set() });
    expect(result).toMatchObject({ capacity: 0, surplus: [], surplusCredits: 0, electivesFull: false });
  });
});
