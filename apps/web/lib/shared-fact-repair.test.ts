import { describe, expect, it } from "vitest";
import type { AcademicRecords } from "@sidera/curriculum-engine";
import { emptyAcademicRecords } from "./academic-storage";
import { programs, programModels } from "./programs";
import { repairNoticeText, repairSharedFacts } from "./shared-fact-repair";

const computing = programs[0]!;
const mathematics = programs[1]!;
const csPlan = computing.snapshot.planVersion.id;
const mathPlan = mathematics.snapshot.planVersion.id;
/* 3008082 y 3006909 son compartidas y existen en ambos planes: sirven para
   comprobar la restauración en cualquiera de las dos direcciones. */
const cryptography = computing.snapshot.versionCourses.find(course => course.academicCode === "3008082")!;
const scientific = computing.snapshot.versionCourses.find(course => course.academicCode === "3006909")!;
const inMath = (code: string) => mathematics.snapshot.versionCourses.find(course => course.academicCode === code)!;
const inComputing = (code: string) => computing.snapshot.versionCourses.find(course => course.academicCode === code)!;

function records(overrides: Partial<AcademicRecords>): AcademicRecords {
  return { ...emptyAcademicRecords(), dual: true, originProgram: "computing", ...overrides };
}
const plan = (marks: Record<string, "COMPLETED" | "IN_PROGRESS" | "UNMARKED">) => ({ marks, externalCompleted: {} });

describe("reparación de hechos compartidos", () => {
  it.each(["IN_PROGRESS", "COMPLETED"] as const)("restaura un %s retirado del plan simulado", fact => {
    const before = records({
      sharedFacts: { [cryptography.courseId]: fact },
      plans: { [mathPlan]: plan({ [inMath("3008082").id]: "UNMARKED" }) },
    });
    const { records: after, restored } = repairSharedFacts(before, programModels);
    expect(after.plans[mathPlan]!.marks[inMath("3008082").id]).toBe(fact);
    expect(restored).toEqual([{ programId: "mathematics", count: 1 }]);
    // Ni el hecho compartido ni el plan de origen se tocan.
    expect(after.sharedFacts).toEqual(before.sharedFacts);
    expect(after.plans[csPlan]).toEqual(before.plans[csPlan]);
  });

  it("restaura también cuando el plan simulado no tiene registro alguno", () => {
    const before = records({ sharedFacts: { [cryptography.courseId]: "IN_PROGRESS" }, plans: {} });
    const { records: after, restored } = repairSharedFacts(before, programModels);
    expect(after.plans[mathPlan]!.marks[inMath("3008082").id]).toBe("IN_PROGRESS");
    expect(restored).toEqual([{ programId: "mathematics", count: 1 }]);
  });

  it("nunca sobrescribe una marca explícita del estudiante", () => {
    const before = records({
      sharedFacts: { [cryptography.courseId]: "COMPLETED" },
      plans: { [mathPlan]: plan({ [inMath("3008082").id]: "IN_PROGRESS" }) },
    });
    const { records: after, restored } = repairSharedFacts(before, programModels);
    expect(after.plans[mathPlan]!.marks[inMath("3008082").id]).toBe("IN_PROGRESS");
    expect(restored).toEqual([]);
    expect(after).toBe(before);
  });

  it("no actúa con la Doble Titulación desactivada", () => {
    const before = records({
      dual: false,
      sharedFacts: { [cryptography.courseId]: "IN_PROGRESS" },
      plans: { [mathPlan]: plan({ [inMath("3008082").id]: "UNMARKED" }) },
    });
    expect(repairSharedFacts(before, programModels)).toEqual({ records: before, restored: [] });
  });

  it("no actúa sin carrera de origen conocida", () => {
    const before = records({ originProgram: undefined, sharedFacts: { [cryptography.courseId]: "IN_PROGRESS" }, plans: {} });
    expect(repairSharedFacts(before, programModels).restored).toEqual([]);
  });

  it("no toca el plan de la carrera de origen", () => {
    // El hueco está en Computación, que aquí es la carrera real: no se rellena.
    const before = records({
      sharedFacts: { [cryptography.courseId]: "IN_PROGRESS" },
      plans: {
        [csPlan]: plan({ [cryptography.id]: "UNMARKED" }),
        [mathPlan]: plan({ [inMath("3008082").id]: "IN_PROGRESS" }),
      },
    });
    const { records: after, restored } = repairSharedFacts(before, programModels);
    expect(after.plans[csPlan]!.marks[cryptography.id]).toBe("UNMARKED");
    expect(restored).toEqual([]);
  });

  it("repara en la dirección inversa cuando el origen es Matemáticas", () => {
    const before = records({
      originProgram: "mathematics",
      sharedFacts: { [cryptography.courseId]: "IN_PROGRESS", [scientific.courseId]: "COMPLETED" },
      plans: { [csPlan]: plan({ [inComputing("3008082").id]: "UNMARKED" }) },
    });
    const { records: after, restored } = repairSharedFacts(before, programModels);
    expect(after.plans[csPlan]!.marks[inComputing("3008082").id]).toBe("IN_PROGRESS");
    expect(after.plans[csPlan]!.marks[inComputing("3006909").id]).toBe("COMPLETED");
    expect(restored).toEqual([{ programId: "computing", count: 2 }]);
    expect(after.plans[mathPlan]).toBeUndefined();
  });

  it("es idempotente: la segunda pasada no cambia nada", () => {
    const before = records({
      sharedFacts: { [cryptography.courseId]: "IN_PROGRESS", [scientific.courseId]: "COMPLETED" },
      plans: { [mathPlan]: plan({ [inMath("3008082").id]: "UNMARKED" }) },
    });
    const first = repairSharedFacts(before, programModels);
    expect(first.restored).toEqual([{ programId: "mathematics", count: 2 }]);
    const second = repairSharedFacts(first.records, programModels);
    expect(second.restored).toEqual([]);
    expect(second.records).toEqual(first.records);
  });

  it("redacta el aviso con singular y plural", () => {
    const label = (id: string) => programs.find(entry => entry.id === id)?.label ?? id;
    expect(repairNoticeText([], label)).toBeUndefined();
    expect(repairNoticeText([{ programId: "mathematics", count: 1 }], label))
      .toBe("Se restauró 1 asignatura compartida en Matemáticas.");
    expect(repairNoticeText([{ programId: "mathematics", count: 3 }], label))
      .toBe("Se restauraron 3 asignaturas compartidas en Matemáticas.");
  });
});
