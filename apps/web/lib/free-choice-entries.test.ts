import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateFreeChoiceProgress, deactivateDual, previewAcademicMark, previewDualActivation, programRecord, recordContext, recordTrajectory, type AcademicRecords, type FreeChoiceEntry } from "@sidera/curriculum-engine";
import { emptyAcademicRecords, loadAcademicRecords, saveAcademicRecords } from "./academic-storage";
import { programs, programModels, verifiedShared } from "./programs";
import { planProgressWithFreeChoice } from "./plan-progress";
import {
  draftOf,
  emptyDraft,
  freeChoiceEntriesOf,
  validateDraft,
  withFreeChoiceEntry,
  withoutFreeChoiceEntry,
} from "./free-choice-entries";

const computing = programs[0]!;
const mathematics = programs[1]!;
const csPlan = computing.snapshot.planVersion.id;
const mathPlan = mathematics.snapshot.planVersion.id;
const entry = (overrides: Partial<FreeChoiceEntry> = {}): FreeChoiceEntry =>
  ({ id: "le-1", name: "Taller de escritura", credits: 3, mark: "COMPLETED", origin: "manual", ...overrides });
const planCodes = new Set(computing.snapshot.versionCourses.map(course => course.academicCode));
const planOf = (records: AcademicRecords, program: typeof computing) => {
  const record = programRecord(records, programModels.find(model => model.id === program.id)!);
  return planProgressWithFreeChoice(
    recordContext(record, program.evaluationContext),
    recordTrajectory(record, program.evaluationContext),
    program.snapshot,
    freeChoiceEntriesOf(records, program.snapshot.planVersion.id),
  );
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
});

describe("validación del formulario", () => {
  const context = { entries: [], planCodes };

  it("exige nombre y créditos enteros positivos", () => {
    const result = validateDraft(emptyDraft(), context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
    expect(result.errors.credits).toBeDefined();
  });

  it.each(["0", "-3", "2.5", "tres", " "])("rechaza %s créditos", credits => {
    const result = validateDraft({ ...emptyDraft(), name: "Taller", credits }, context);
    expect(result.ok).toBe(false);
  });

  it("acepta un registro mínimo y le da identificador propio", () => {
    const result = validateDraft({ name: " Taller de escritura ", credits: "3", mark: "COMPLETED", academicCode: "" }, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({ name: "Taller de escritura", credits: 3, mark: "COMPLETED", origin: "manual" });
    expect(result.entry.id.length).toBeGreaterThan(0);
    // Sin código: la propiedad no se inventa.
    expect(result.entry.academicCode).toBeUndefined();
  });

  it("impide el doble conteo con un código ya presente en el plan", () => {
    const result = validateDraft({ name: "Cálculo diferencial", credits: "4", mark: "COMPLETED", academicCode: "1000004-M" }, context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.academicCode).toContain("ya está en el plan");
  });

  it("impide repetir el mismo código entre registros manuales, pero permite varios sin código", () => {
    const existing = [entry({ id: "le-1", academicCode: "ABC123" }), entry({ id: "le-2", name: "Otra" })];
    const repetido = validateDraft({ name: "Tercera", credits: "2", mark: "COMPLETED", academicCode: "ABC123" }, { entries: existing, planCodes });
    expect(repetido.ok).toBe(false);
    const sinCodigo = validateDraft({ name: "Tercera", credits: "2", mark: "COMPLETED", academicCode: "" }, { entries: existing, planCodes });
    expect(sinCodigo.ok).toBe(true);
  });

  it("al editar, su propio código no se considera duplicado", () => {
    const existing = [entry({ id: "le-1", academicCode: "ABC123" })];
    const result = validateDraft(draftOf(existing[0]!), { id: "le-1", entries: existing, planCodes });
    expect(result.ok).toBe(true);
  });
});

describe("alta, edición y baja", () => {
  it("añade, sustituye en su sitio y elimina", () => {
    let records = withFreeChoiceEntry(emptyAcademicRecords(), csPlan, entry());
    records = withFreeChoiceEntry(records, csPlan, entry({ id: "le-2", name: "Segunda", credits: 2 }));
    expect(freeChoiceEntriesOf(records, csPlan).map(item => item.name)).toEqual(["Taller de escritura", "Segunda"]);

    records = withFreeChoiceEntry(records, csPlan, entry({ name: "Taller de escritura creativa", credits: 4, mark: "IN_PROGRESS" }));
    expect(freeChoiceEntriesOf(records, csPlan)[0]).toMatchObject({ id: "le-1", name: "Taller de escritura creativa", credits: 4, mark: "IN_PROGRESS" });
    expect(freeChoiceEntriesOf(records, csPlan)).toHaveLength(2);

    records = withoutFreeChoiceEntry(records, csPlan, "le-1");
    expect(freeChoiceEntriesOf(records, csPlan).map(item => item.id)).toEqual(["le-2"]);
  });

  it("conserva las marcas del plan al registrar una asignatura", () => {
    const marcado = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, "computing",
      computing.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!.courseId, "COMPLETED").next;
    const conRegistro = withFreeChoiceEntry(marcado, csPlan, entry());
    expect(conRegistro.plans[csPlan]!.marks).toEqual(marcado.plans[csPlan]!.marks);
  });
});

describe("aislamiento entre programas", () => {
  it("un registro de Computación no aparece en Matemáticas", () => {
    const records = withFreeChoiceEntry(emptyAcademicRecords(), csPlan, entry());
    expect(freeChoiceEntriesOf(records, csPlan)).toHaveLength(1);
    expect(freeChoiceEntriesOf(records, mathPlan)).toEqual([]);
    expect(planOf(records, mathematics).freeChoice.entriesApproved).toBe(0);
  });

  it("la Doble Titulación no copia, sincroniza ni borra registros manuales", () => {
    let records = withFreeChoiceEntry(emptyAcademicRecords(), csPlan, entry());
    records = withFreeChoiceEntry(records, mathPlan, entry({ id: "le-m", name: "Seminario", credits: 2, mark: "IN_PROGRESS" }));
    const vinculado = previewDualActivation({ ...records, originProgram: "computing" }, programModels, verifiedShared).next;

    expect(freeChoiceEntriesOf(vinculado, csPlan)).toEqual(freeChoiceEntriesOf(records, csPlan));
    expect(freeChoiceEntriesOf(vinculado, mathPlan)).toEqual(freeChoiceEntriesOf(records, mathPlan));
    // Y al desactivar siguen intactos.
    const desvinculado = deactivateDual(vinculado);
    expect(freeChoiceEntriesOf(desvinculado, csPlan).map(item => item.id)).toEqual(["le-1"]);
    expect(freeChoiceEntriesOf(desvinculado, mathPlan).map(item => item.id)).toEqual(["le-m"]);
  });

  it("marcar una asignatura compartida no pierde los registros manuales", () => {
    const records = withFreeChoiceEntry({ ...emptyAcademicRecords(), dual: true, originProgram: "computing" }, mathPlan, entry({ id: "le-m" }));
    const preview = previewAcademicMark(records, programModels, verifiedShared, "computing",
      computing.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!.courseId, "COMPLETED");
    expect(freeChoiceEntriesOf(preview.next, mathPlan).map(item => item.id)).toEqual(["le-m"]);
  });
});

describe("integración con el cálculo de créditos", () => {
  it("las Completadas aprueban y las En curso solo proyectan", () => {
    let records = withFreeChoiceEntry(emptyAcademicRecords(), csPlan, entry({ credits: 3 }));
    records = withFreeChoiceEntry(records, csPlan, entry({ id: "le-2", name: "Coro", credits: 2, mark: "IN_PROGRESS" }));
    const plan = planOf(records, computing);
    expect(plan.freeChoice).toMatchObject({ estimatedCredits: 3, projectedCredits: 5, entriesApproved: 3, entriesInProgress: 2 });
    expect(plan.satisfiedCredits).toBe(plan.progress.satisfiedCredits + 3);
  });

  it("suma con los excedentes automáticos sin duplicar créditos", () => {
    // Dos optativas de la agrupación Matemáticas: el cupo es 4, sobran 4.
    let records = emptyAcademicRecords();
    for (const code of ["3010334", "3010390", "3006905", "3006900"]) {
      records = previewAcademicMark(records, programModels, verifiedShared, "computing",
        computing.snapshot.versionCourses.find(course => course.academicCode === code)!.courseId, "COMPLETED").next;
    }
    const conRegistro = withFreeChoiceEntry(records, csPlan, entry({ credits: 3 }));
    const plan = planOf(conRegistro, computing);
    expect(plan.freeChoice.surplusApproved).toBe(4);
    expect(plan.freeChoice.entriesApproved).toBe(3);
    expect(plan.freeChoice.estimatedCredits).toBe(7);
    // Lo aprobado del plan es agrupaciones + Libre Elección, sin repetir nada.
    expect(plan.satisfiedCredits).toBe(plan.progress.satisfiedCredits + 7);
  });

  it.each([[computing, 29], [mathematics, 28]] as const)("respeta el tope del componente y conserva lo que sobra", (program, required) => {
    const plan = program.snapshot.planVersion.id;
    let records = emptyAcademicRecords();
    for (let index = 0; index < 8; index += 1) {
      records = withFreeChoiceEntry(records, plan, entry({ id: `le-${index}`, name: `Curso ${index}`, credits: 5 }));
    }
    const result = planOf(records, program).freeChoice;
    expect(result.requiredCredits).toBe(required);
    expect(result.estimatedCredits).toBe(required);
    expect(result.uncountedCredits).toBe(40 - required);
    // Ningún registro se pierde por superar el cupo.
    expect(freeChoiceEntriesOf(records, plan)).toHaveLength(8);
  });

  it("no cuenta una asignatura manual como excedente de ninguna agrupación", () => {
    const records = withFreeChoiceEntry(emptyAcademicRecords(), csPlan, entry({ credits: 3 }));
    const record = programRecord(records, programModels[0]!);
    const sinRegistros = calculateFreeChoiceProgress(recordContext(record, computing.evaluationContext), recordTrajectory(record, computing.evaluationContext), 29);
    expect(sinRegistros.contributors).toEqual([]);
    expect(sinRegistros.estimatedCredits).toBe(0);
  });
});

/* La cabecera y la barra de Libre Elección salieron una vez descoordinadas
   porque la barra de contexto llamaba al cálculo central sin los registros.
   Estas pruebas fijan que el total del plan los incluya siempre. */
describe("coherencia del progreso general", () => {
  const marcado = () => {
    let records = emptyAcademicRecords();
    for (const code of ["1000004-M", "3010334"]) {
      records = previewAcademicMark(records, programModels, verifiedShared, "computing",
        computing.snapshot.versionCourses.find(course => course.academicCode === code)!.courseId, "COMPLETED").next;
    }
    return records;
  };

  it("una asignatura Completada suma al total aprobado del plan", () => {
    const base = planOf(marcado(), computing);
    expect(base.satisfiedCredits).toBe(8);
    const conRegistro = planOf(withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 4 })), computing);
    expect(conRegistro.satisfiedCredits).toBe(12);
    expect(conRegistro.requiredCredits).toBe(146);
    // Y no se cuela en el progreso de las agrupaciones.
    expect(conRegistro.progress.satisfiedCredits).toBe(base.progress.satisfiedCredits);
  });

  it("una asignatura En curso suma a la proyección, no a lo aprobado", () => {
    const records = withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 4, mark: "IN_PROGRESS" }));
    const plan = planOf(records, computing);
    expect(plan.satisfiedCredits).toBe(8);
    expect(plan.projectedSatisfiedCredits - plan.satisfiedCredits).toBe(4);
  });

  it("editar el estado mueve los créditos entre aprobado y proyección", () => {
    const enCurso = withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 4, mark: "IN_PROGRESS" }));
    const completada = withFreeChoiceEntry(enCurso, csPlan, entry({ credits: 4, mark: "COMPLETED" }));
    expect(planOf(enCurso, computing).satisfiedCredits).toBe(8);
    expect(planOf(completada, computing).satisfiedCredits).toBe(12);
    expect(planOf(completada, computing).projectedSatisfiedCredits).toBe(12);
  });

  it("editar los créditos se refleja en el total, y eliminar lo devuelve", () => {
    const tres = withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 3 }));
    const seis = withFreeChoiceEntry(tres, csPlan, entry({ credits: 6 }));
    expect(planOf(tres, computing).satisfiedCredits).toBe(11);
    expect(planOf(seis, computing).satisfiedCredits).toBe(14);
    expect(planOf(withoutFreeChoiceEntry(seis, csPlan, "le-1"), computing).satisfiedCredits).toBe(8);
  });

  it("el total del plan es siempre agrupaciones más Libre Elección", () => {
    let records = withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 4 }));
    records = withFreeChoiceEntry(records, csPlan, entry({ id: "le-2", name: "Coro", credits: 3, mark: "IN_PROGRESS" }));
    const plan = planOf(records, computing);
    expect(plan.satisfiedCredits).toBe(plan.progress.satisfiedCredits + plan.freeChoice.estimatedCredits);
    expect(plan.projectedSatisfiedCredits).toBe(plan.progress.projectedSatisfiedCredits + plan.freeChoice.projectedCredits);
    expect(plan.satisfiedCredits).toBeLessThanOrEqual(plan.requiredCredits);
  });

  it("cada programa suma solo sus propios registros, también con Doble Titulación", () => {
    let records = withFreeChoiceEntry(marcado(), csPlan, entry({ credits: 4 }));
    records = withFreeChoiceEntry(records, mathPlan, entry({ id: "le-m", name: "Seminario", credits: 2 }));
    const vinculado = previewDualActivation({ ...records, originProgram: "computing" }, programModels, verifiedShared).next;
    expect(planOf(vinculado, computing).freeChoice.entriesApproved).toBe(4);
    expect(planOf(vinculado, mathematics).freeChoice.entriesApproved).toBe(2);
  });
});

describe("persistencia", () => {
  it("sobrevive al guardado y la recarga, junto a las marcas previas", () => {
    let records = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, "computing",
      computing.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!.courseId, "COMPLETED").next;
    records = withFreeChoiceEntry(records, csPlan, entry({ academicCode: "ABC123" }));
    expect(saveAcademicRecords(records)).toBe(true);

    const recargado = loadAcademicRecords();
    expect(recargado.writable).toBe(true);
    expect(freeChoiceEntriesOf(recargado.records, csPlan)).toEqual([entry({ academicCode: "ABC123" })]);
    expect(recargado.records.plans[csPlan]!.marks).toEqual(records.plans[csPlan]!.marks);
  });

  it("un registro guardado antes de existir esta función sigue siendo válido", () => {
    const anterior = previewAcademicMark(emptyAcademicRecords(), programModels, verifiedShared, "computing",
      computing.snapshot.versionCourses.find(course => course.academicCode === "1000004-M")!.courseId, "COMPLETED").next;
    expect(anterior.plans[csPlan]!.freeChoice).toBeUndefined();
    saveAcademicRecords(anterior);
    const recargado = loadAcademicRecords();
    expect(recargado.writable).toBe(true);
    expect(freeChoiceEntriesOf(recargado.records, csPlan)).toEqual([]);
  });
});
