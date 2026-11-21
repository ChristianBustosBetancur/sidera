import { describe, expect, it } from "vitest";
import {
  calculateSatisfiedPlanProgress,
  deriveVersionCourseState,
  previewAcademicMark,
  previewDualActivation,
  programRecord,
  recordContext,
  recordTrajectory,
  type AcademicRecords,
} from "@sidera/curriculum-engine";
import { emptyAcademicRecords } from "./academic-storage";
import { programs, programModels, verifiedShared } from "./programs";
import { isSharedFact, isSimulatedProgram, marksAreAvailable } from "./dual-roles";

const computing = programs[0]!;
const mathematics = programs[1]!;
const cryptography = computing.snapshot.versionCourses.find(course => course.academicCode === "3008082")!;
const inMathematics = mathematics.snapshot.versionCourses.find(course => course.courseId === cryptography.courseId)!;
const prerequisite = computing.snapshot.versionCourses.find(course => course.academicCode === "3006934")!;

/* 3008082 cumple requisitos en Computación y no en Matemáticas: es el caso
   que distingue una matrícula real de lo que un plan simulado opina de ella. */
function linked(): AcademicRecords {
  let records = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, "computing", prerequisite.courseId, "COMPLETED").next;
  records = previewAcademicMark(records, programModels, verifiedShared, "computing", cryptography.courseId, "IN_PROGRESS").next;
  return previewDualActivation({ ...records, originProgram: "computing" }, programModels, verifiedShared).next;
}

describe("tarjeta de un hecho compartido en el plan simulado", () => {
  const records = linked();
  const record = programRecord(records, programModels[1]!);
  const trajectory = recordTrajectory(record, mathematics.evaluationContext);
  const context = recordContext(record, mathematics.evaluationContext);

  it("trata Matemáticas como simulado y Computación como la carrera real", () => {
    expect(isSimulatedProgram(records, "mathematics")).toBe(true);
    expect(isSimulatedProgram(records, "computing")).toBe(false);
    expect(isSharedFact(records, cryptography.courseId)).toBe(true);
  });

  it("se muestra «En curso», no «Bloqueada» ni «Sin marcar»", () => {
    expect(record.marks[inMathematics.id]).toBe("IN_PROGRESS");
    expect(deriveVersionCourseState(inMathematics.id, context, trajectory).state).toBe("IN_PROGRESS");
  });

  it("sigue sin cumplir requisitos en el plan simulado: por eso se advierte", () => {
    const withoutTheFact = { completedVersionCourseIds: trajectory.completedVersionCourseIds, inProgressVersionCourseIds: [] };
    expect(deriveVersionCourseState(inMathematics.id, context, withoutTheFact).state).toBe("BLOCKED");
  });

  it("deja las acciones disponibles aunque el plan lo considere bloqueado", () => {
    expect(marksAreAvailable(records, cryptography.courseId, true)).toBe(true);
    // Una asignatura propia del plan sí se bloquea como siempre.
    const own = mathematics.snapshot.versionCourses.find(course => !verifiedShared.includes(course.courseId))!;
    expect(marksAreAvailable(records, own.courseId, true)).toBe(false);
  });

  it("cuenta sus créditos como en curso dentro del plan simulado", () => {
    const progress = calculateSatisfiedPlanProgress(context, trajectory, mathematics.snapshot.planVersion.requiredCredits);
    expect(progress.projectedSatisfiedCredits - progress.satisfiedCredits).toBeGreaterThanOrEqual(inMathematics.credits);
  });
});
