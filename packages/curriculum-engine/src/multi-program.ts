import type { CourseId, VersionCourseId } from "@sidera/curriculum-domain";
import { reconcileTrajectory } from "./reconciliation.js";
import type { CurriculumEvaluationContext, StudentTrajectory, TrajectoryMark, TrajectoryReconciliation } from "./types.js";

export type ProgramRecord = { marks: Record<string, TrajectoryMark>; externalCompleted: Record<string, boolean> };
export type AcademicRecords = {
  formatVersion: 2;
  activeProgram: string;
  dual: boolean;
  /* Carrera real del estudiante. Con el modo dual activo, los demás planes
     no pueden retirar automáticamente una matrícula compartida. Los créditos
     siguen evaluándose con el contexto independiente de cada plan. */
  originProgram?: string;
  plans: Record<string, ProgramRecord>;
  sharedFacts: Record<string, TrajectoryMark>;
};
export type ProgramModel = { id: string; context: CurriculumEvaluationContext };
export type SharedConflict = { courseId: CourseId; states: { programId: string; mark: TrajectoryMark }[] };
export type SharedAdoption = { courseId: CourseId; mark: TrajectoryMark };
export type AcademicPreview = {
  next: AcademicRecords;
  conflicts: SharedConflict[];
  // Cursos cuyo estado se propaga al otro plan sin necesidad de elegir: hay un
  // único estado explícito y el otro programa no lo contradice.
  shared: SharedAdoption[];
  reconciliations: { programId: string; result: TrajectoryReconciliation }[];
  changes: { programId: string; courseId: CourseId; before?: TrajectoryMark; after: TrajectoryMark }[];
  requiresConfirmation: boolean;
};

export function programRecord(records: AcademicRecords, model: ProgramModel): ProgramRecord {
  return records.plans[model.context.planVersionId] ?? { marks: {}, externalCompleted: {} };
}
export function recordTrajectory(record: ProgramRecord, context: CurriculumEvaluationContext): StudentTrajectory {
  const known = new Set(context.versionCourses.map(course => course.id));
  const entries = Object.entries(record.marks).filter(([id]) => known.has(id as VersionCourseId));
  return {
    completedVersionCourseIds: entries.filter(([, mark]) => mark === "COMPLETED").map(([id]) => id as VersionCourseId),
    inProgressVersionCourseIds: entries.filter(([, mark]) => mark === "IN_PROGRESS").map(([id]) => id as VersionCourseId),
  };
}
export function recordContext(record: ProgramRecord, context: CurriculumEvaluationContext): CurriculumEvaluationContext {
  return { ...context, completedExternalCourseIds: Object.entries(record.externalCompleted).filter(([, completed]) => completed).map(([id]) => id as CourseId) };
}

function clone(records: AcademicRecords): AcademicRecords {
  return { ...records, sharedFacts: { ...records.sharedFacts }, plans: Object.fromEntries(Object.entries(records.plans).map(([id, record]) => [id, { marks: { ...record.marks }, externalCompleted: { ...record.externalCompleted } }])) };
}
function placements(models: readonly ProgramModel[], courseId: CourseId) {
  return models.flatMap(model => {
    const course = model.context.versionCourses.find(course => course.courseId === courseId);
    const external = model.context.externalCourses?.some(course => course.id === courseId);
    return course || external ? [{ model, course }] : [];
  });
}
function currentMark(records: AcademicRecords, model: ProgramModel, courseId: CourseId): TrajectoryMark | undefined {
  const record = programRecord(records, model);
  const course = model.context.versionCourses.find(course => course.courseId === courseId);
  if (course) return record.marks[course.id];
  const completed = record.externalCompleted[courseId];
  return completed === undefined ? undefined : completed ? "COMPLETED" : "UNMARKED";
}
function write(preview: AcademicPreview, model: ProgramModel, courseId: CourseId, mark: TrajectoryMark) {
  const before = currentMark(preview.next, model, courseId);
  if (before === mark) return;
  const record = programRecord(preview.next, model);
  preview.next.plans[model.context.planVersionId] = record;
  const course = model.context.versionCourses.find(course => course.courseId === courseId);
  // An external prerequisite has no enrolment or credits in this plan.
  // Moving the shared fact back to IN_PROGRESS revokes completion without
  // inventing an explicit UNMARKED academic choice for this external entry.
  if (!course && mark === "IN_PROGRESS") {
    if (record.externalCompleted[courseId] === true) {
      delete record.externalCompleted[courseId];
      preview.changes.push({ programId: model.id, courseId, before, after: "UNMARKED" });
    }
    return;
  }
  if (course) record.marks[course.id] = mark;
  else record.externalCompleted[courseId] = mark === "COMPLETED";
  preview.changes.push({ programId: model.id, courseId, before, after: mark });
}
function start(records: AcademicRecords): AcademicPreview {
  return { next: clone(records), conflicts: [], shared: [], reconciliations: [], changes: [], requiresConfirmation: false };
}
function preservedInProgress(records: AcademicRecords, model: ProgramModel): VersionCourseId[] {
  if (!records.dual || records.originProgram === undefined || model.id === records.originProgram) return [];
  const record = programRecord(records, model);
  return model.context.versionCourses
    .filter(course => record.marks[course.id] === "IN_PROGRESS" && records.sharedFacts[course.courseId] === "IN_PROGRESS")
    .map(course => course.id);
}
function reconcile(preview: AcademicPreview, models: readonly ProgramModel[]) {
  for (const model of models) {
    const record = programRecord(preview.next, model);
    const first = model.context.versionCourses[0];
    if (!first) continue;
    const result = reconcileTrajectory({ versionCourseId: first.id, mark: record.marks[first.id] ?? "UNMARKED" }, recordContext(record, model.context), recordTrajectory(record, model.context), preservedInProgress(preview.next, model));
    for (const invalidation of result.invalidations) record.marks[invalidation.versionCourseId] = "UNMARKED";
    if (result.invalidations.length) {
      preview.next.plans[model.context.planVersionId] = record;
      preview.requiresConfirmation = true;
    }
    preview.reconciliations.push({ programId: model.id, result: {
      ...result,
      // La trayectoria es un conjunto sin orden temporal; devolvemos el mismo
      // orden de serialización que los registros que se aplicarán al confirmar.
      nextTrajectory: recordTrajectory(record, model.context),
    } });
    // Invalidations are effects in this plan. Never overwrite sharedFacts here.
  }
}

export function previewAcademicMark(records: AcademicRecords, models: readonly ProgramModel[], verifiedShared: readonly CourseId[], programId: string, courseId: CourseId, mark: TrajectoryMark): AcademicPreview {
  const preview = start(records);
  const targets = placements(models, courseId);
  const active = targets.find(target => target.model.id === programId);
  if (!active) throw new Error("Unknown academic course for program");
  if (!active.course && mark === "IN_PROGRESS") throw new Error("External prerequisite records completion only");
  const shared = records.dual && verifiedShared.includes(courseId);
  for (const target of targets.filter(target => shared || target.model.id === programId)) write(preview, target.model, courseId, mark);
  // Reflejar el hecho compartido no es, por sí solo, motivo para confirmar:
  // es lo que el estudiante pidió al vincular los planes. La confirmación la
  // decide `reconcile`, que la exige cuando el cambio invalida otras
  // asignaturas en alguno de los programas.
  if (shared) preview.next.sharedFacts[courseId] = mark;
  reconcile(preview, models.filter(model => targets.some(target => target.model.id === model.id && (shared || model.id === programId))));
  return preview;
}

export function previewDualActivation(records: AcademicRecords, models: readonly ProgramModel[], verifiedShared: readonly CourseId[], resolutions: Readonly<Record<string, TrajectoryMark>> = {}): AcademicPreview {
  const preview = start(records);
  preview.next.dual = true;
  preview.requiresConfirmation = true;
  for (const courseId of verifiedShared) {
    const targets = placements(models, courseId);
    const states = targets.flatMap(({ model }) => {
      const mark = currentMark(records, model, courseId);
      return mark === undefined ? [] : [{ programId: model.id, mark }];
    });
    // «Sin marcar» no es una postura académica que debatir: es la ausencia de
    // registro. Solo los estados explícitos entran en la clasificación, así
    // que un plan marcado frente a otro sin marcar se comparte directamente y
    // únicamente Completada frente a En curso exige elegir.
    const explicit = states.filter(state => state.mark !== "UNMARKED");
    const marks = new Set(explicit.map(state => state.mark));
    const resolution = resolutions[courseId];
    if (marks.size > 1 && resolution === undefined) { preview.conflicts.push({ courseId, states: explicit }); continue; }
    const mark = resolution ?? explicit[0]?.mark;
    if (!mark) continue;
    preview.next.sharedFacts[courseId] = mark;
    const applied = preview.changes.length;
    for (const { model } of targets) write(preview, model, courseId, mark);
    if (preview.changes.length > applied) preview.shared.push({ courseId, mark });
  }
  reconcile(preview, models);
  return preview;
}

export function deactivateDual(records: AcademicRecords): AcademicRecords {
  return { ...records, dual: false };
}
