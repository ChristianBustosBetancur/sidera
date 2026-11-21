import type { AcademicRecords, FreeChoiceEntry, ProgramRecord } from "@sidera/curriculum-engine";

/* Registro de asignaturas declaradas como Libre Elección.

   Viven dentro del plan al que pertenecen, nunca en un almacén aparte: así una
   asignatura de Computación no puede aparecer en Matemáticas por accidente, ni
   siquiera con la Doble Titulación activa, porque la sincronización compartida
   solo opera sobre marcas de materias del catálogo.

   El identificador es propio y estable. El código académico es opcional, puede
   repetirse entre planes y el estudiante puede cambiarlo, así que no sirve como
   identidad. `origin` queda listo para que, cuando exista el buscador, una
   asignatura elegida de un catálogo entre por este mismo camino. */

export type FreeChoiceDraft = {
  name: string;
  credits: string;
  mark: FreeChoiceEntry["mark"];
  academicCode: string;
};

export const emptyDraft = (): FreeChoiceDraft => ({ name: "", credits: "", mark: "COMPLETED", academicCode: "" });

export const draftOf = (entry: FreeChoiceEntry): FreeChoiceDraft => ({
  name: entry.name,
  credits: String(entry.credits),
  mark: entry.mark,
  academicCode: entry.academicCode ?? "",
});

export function freeChoiceEntriesOf(records: AcademicRecords, planVersionId: string): FreeChoiceEntry[] {
  return records.plans[planVersionId]?.freeChoice ?? [];
}

export function newEntryId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `le-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function withPlan(records: AcademicRecords, planVersionId: string, change: (record: ProgramRecord) => ProgramRecord): AcademicRecords {
  const record = records.plans[planVersionId] ?? { marks: {}, externalCompleted: {} };
  return { ...records, plans: { ...records.plans, [planVersionId]: change(record) } };
}

/** Añade si el identificador es nuevo; si ya existe, lo sustituye en su sitio. */
export function withFreeChoiceEntry(records: AcademicRecords, planVersionId: string, entry: FreeChoiceEntry): AcademicRecords {
  return withPlan(records, planVersionId, record => {
    const current = record.freeChoice ?? [];
    const existing = current.some(item => item.id === entry.id);
    return { ...record, freeChoice: existing ? current.map(item => (item.id === entry.id ? entry : item)) : [...current, entry] };
  });
}

export function withoutFreeChoiceEntry(records: AcademicRecords, planVersionId: string, id: string): AcademicRecords {
  return withPlan(records, planVersionId, record => ({
    ...record,
    freeChoice: (record.freeChoice ?? []).filter(item => item.id !== id),
  }));
}

export type DraftValidation =
  | { ok: true; entry: FreeChoiceEntry }
  | { ok: false; errors: Partial<Record<keyof FreeChoiceDraft, string>> };

/* Un código vacío no identifica nada: dos asignaturas sin código no son la
   misma. Solo cuando hay código se comprueba que no esté ya contabilizado en
   este plan, ni por el catálogo ni por otro registro manual. */
export function validateDraft(draft: FreeChoiceDraft, context: {
  id?: string;
  entries: readonly FreeChoiceEntry[];
  planCodes: ReadonlySet<string>;
}): DraftValidation {
  const errors: Partial<Record<keyof FreeChoiceDraft, string>> = {};
  const name = draft.name.trim();
  const academicCode = draft.academicCode.trim();
  const credits = Number(draft.credits);

  if (name.length === 0) errors.name = "Escribe el nombre de la asignatura.";
  if (!/^\d+$/.test(draft.credits.trim()) || !Number.isInteger(credits) || credits <= 0) {
    errors.credits = "Los créditos deben ser un número entero mayor que cero.";
  }
  if (academicCode.length > 0) {
    if (context.planCodes.has(academicCode)) {
      errors.academicCode = "Ese código ya está en el plan de este programa: se contaría dos veces.";
    } else if (context.entries.some(entry => entry.id !== context.id && entry.academicCode === academicCode)) {
      errors.academicCode = "Ya registraste una asignatura con ese código en este programa.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    entry: {
      id: context.id ?? newEntryId(),
      name,
      credits,
      mark: draft.mark,
      origin: "manual",
      ...(academicCode.length > 0 ? { academicCode } : {}),
    },
  };
}
