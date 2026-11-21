import { describe, expect, it } from "vitest";
import { calculateFreeChoiceProgress, previewAcademicMark, previewDualActivation, programRecord, recordContext, recordTrajectory, type AcademicRecords } from "@sidera/curriculum-engine";
import { emptyAcademicRecords } from "./academic-storage";
import { programs, programModels, verifiedShared } from "./programs";
import { freeChoiceRequiredCredits, planProgressWithFreeChoice } from "./plan-progress";

const computing = programs[0]!;
const mathematics = programs[1]!;
const code = (program: typeof computing, academicCode: string) =>
  program.snapshot.versionCourses.find(course => course.academicCode === academicCode)!;
const mark = (records: AcademicRecords, programId: string, academicCode: string, state: "COMPLETED" | "IN_PROGRESS") =>
  previewAcademicMark(records, programModels, verifiedShared, programId,
    code(programs.find(entry => entry.id === programId)!, academicCode).courseId, state).next;
const planOf = (records: AcademicRecords, program: typeof computing) => {
  const record = programRecord(records, programModels.find(entry => entry.id === program.id)!);
  return planProgressWithFreeChoice(recordContext(record, program.evaluationContext), recordTrajectory(record, program.evaluationContext), program.snapshot, record.freeChoice ?? []);
};

describe("Libre Elección sobre los catálogos reales", () => {
  it("toma el requisito del componente sin agrupaciones de cada programa", () => {
    expect(freeChoiceRequiredCredits(mathematics.snapshot)).toBe(28);
    expect(freeChoiceRequiredCredits(computing.snapshot)).toBe(29);
  });

  /* Caso prioritario: Matemática Aplicada exige 8 créditos, 4 de la
     obligatoria 3006886 y 4 de cupo optativo. */
  it("reparte el caso de Matemática Aplicada como se acordó", () => {
    /* Criptografía está En curso de verdad en Computación, donde cumple su
       prerrequisito. En Matemáticas es una matrícula preservada del plan
       simulado: conserva su advertencia y proyecta como cualquier En curso. */
    let records = mark(emptyAcademicRecords(), "computing", "3006934", "COMPLETED");
    records = mark(records, "computing", "3008082", "IN_PROGRESS");
    records = mark(records, "mathematics", "3006909", "COMPLETED");
    records = mark(records, "mathematics", "3006884", "COMPLETED");
    records = previewDualActivation({ ...records, originProgram: "computing" }, programModels, verifiedShared).next;
    expect(programRecord(records, programModels[1]!).marks[code(mathematics, "3008082").id]).toBe("IN_PROGRESS");

    const plan = planOf(records, mathematics);
    const applied = plan.progress.components.flatMap(component => component.groupings)
      .find(entry => entry.groupingId.endsWith("-applied"))!;
    // La agrupación no se mueve: sigue faltando la obligatoria.
    expect(applied.satisfiedCredits).toBe(4);
    expect(applied.requiredCredits).toBe(8);
    // 3006884 cubre el cupo por código; 3006909 sobra; 3008082 proyecta.
    expect(plan.freeChoice.estimatedCredits).toBe(4);
    expect(plan.freeChoice.projectedCredits).toBe(8);
    expect(plan.freeChoice.contributors.map(entry => entry.versionCourseId)).toEqual([
      code(mathematics, "3006909").id,
      code(mathematics, "3008082").id,
    ]);
    expect(plan.freeChoice.contributors.map(entry => entry.mark)).toEqual(["COMPLETED", "IN_PROGRESS"]);
  });

  it("no cuenta dos veces: lo aprobado del plan es agrupación más Libre Elección", () => {
    let records = mark(emptyAcademicRecords(), "mathematics", "3006909", "COMPLETED");
    records = mark(records, "mathematics", "3006884", "COMPLETED");
    const plan = planOf(records, mathematics);
    // Ocho créditos cursados: cuatro los reconoce la agrupación y cuatro LE.
    expect(plan.progress.satisfiedCredits).toBe(4);
    expect(plan.freeChoice.estimatedCredits).toBe(4);
    expect(plan.satisfiedCredits).toBe(8);
    expect(plan.satisfiedCredits).toBeLessThanOrEqual(plan.requiredCredits);
  });

  it("reasigna al desmarcar y nunca produce progreso negativo", () => {
    const dos = mark(mark(emptyAcademicRecords(), "mathematics", "3006909", "COMPLETED"), "mathematics", "3006884", "COMPLETED");
    const una = previewAcademicMark(dos, programModels, verifiedShared, "mathematics", code(mathematics, "3006909").courseId, "UNMARKED").next;
    expect(planOf(dos, mathematics).freeChoice.estimatedCredits).toBe(4);
    expect(planOf(una, mathematics).freeChoice.estimatedCredits).toBe(0);
    expect(planOf(emptyAcademicRecords(), mathematics).freeChoice.estimatedCredits).toBe(0);
  });

  it("una materia que pasa de En curso a Completada mueve la proyección a estimado", () => {
    let records = mark(emptyAcademicRecords(), "mathematics", "3006884", "COMPLETED");
    records = mark(records, "mathematics", "3006909", "IN_PROGRESS");
    const antes = planOf(records, mathematics).freeChoice;
    expect(antes).toMatchObject({ estimatedCredits: 0, projectedCredits: 4 });
    const despues = planOf(mark(records, "mathematics", "3006909", "COMPLETED"), mathematics).freeChoice;
    expect(despues).toMatchObject({ estimatedCredits: 4, projectedCredits: 4 });
  });

  it.each(["computing", "mathematics"])("calcula Libre Elección por plan con origen %s", origin => {
    const simulated = origin === "computing" ? "mathematics" : "computing";
    // 3006909 y 3006884 son compartidas: al vincular aparecen en ambos planes.
    let records = mark(emptyAcademicRecords(), origin, "3006909", "COMPLETED");
    records = mark(records, origin, "3006884", "COMPLETED");
    records = previewDualActivation({ ...records, originProgram: origin }, programModels, verifiedShared).next;

    for (const program of [computing, mathematics]) {
      const plan = planOf(records, program);
      expect(plan.freeChoice.requiredCredits).toBe(program.id === "mathematics" ? 28 : 29);
      expect(plan.freeChoice.estimatedCredits).toBeGreaterThanOrEqual(0);
      expect(plan.satisfiedCredits).toBe(plan.progress.satisfiedCredits + plan.freeChoice.estimatedCredits);
    }
    // En Matemáticas ambas caen en Matemática Aplicada (cupo 4): una sobra.
    expect(planOf(records, mathematics).freeChoice.estimatedCredits).toBe(4);
    // En Computación están en agrupaciones distintas, con cupo suficiente.
    expect(planOf(records, computing).freeChoice.estimatedCredits).toBe(0);
    expect(simulated).toBeDefined();
  });

  it("tope del componente: no acredita por encima del requisito y lo informa", () => {
    const context = mathematics.evaluationContext;
    const electives = mathematics.snapshot.versionCourses.filter(course => !course.mandatory && course.groupingId.endsWith("-electives"));
    // Electivas Disciplinares: cupo 4, de modo que casi toda la oferta sobra.
    const trajectory = { completedVersionCourseIds: electives.slice(0, 9).map(course => course.id), inProgressVersionCourseIds: [] };
    const result = calculateFreeChoiceProgress(context, trajectory, 28);
    expect(result.estimatedCredits).toBe(28);
    expect(result.uncountedCredits).toBe(electives.slice(0, 9).reduce((total, course) => total + course.credits, 0) - 4 - 28);
  });
});
