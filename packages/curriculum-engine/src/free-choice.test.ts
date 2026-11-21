import { describe, expect, it } from "vitest";
import type { ComponentId, CourseId, GroupingId, PlanVersionId, VersionCourseId } from "@sidera/curriculum-domain";
import { calculateFreeChoiceProgress, groupingSurpluses } from "./free-choice.js";
import { calculateSatisfiedPlanProgress } from "./progress.js";
import type { CurriculumEvaluationContext, StudentTrajectory } from "./types.js";

const plan = "plan" as PlanVersionId;
const component = "component" as ComponentId;
const group = (key: string) => `group:${key}` as GroupingId;
const id = (key: string) => `course:${key}` as VersionCourseId;

function course(key: string, groupKey: string, credits: number, mandatory: boolean) {
  return { id: id(key), courseId: `institution:${key}` as CourseId, planVersionId: plan, groupingId: group(groupKey), academicCode: key, credits, mandatory };
}
function context(groupings: { key: string; required: number }[], courses: ReturnType<typeof course>[]): CurriculumEvaluationContext {
  return {
    planVersionId: plan,
    components: [{ id: component, planVersionId: plan, name: "Componente", requiredCredits: groupings.reduce((total, entry) => total + entry.required, 0) }],
    groupings: groupings.map(entry => ({ id: group(entry.key), componentId: component, planVersionId: plan, name: entry.key, requiredCredits: entry.required })),
    versionCourses: courses,
  };
}
const trajectory = (completed: string[], inProgress: string[] = []): StudentTrajectory => ({
  completedVersionCourseIds: completed.map(id),
  inProgressVersionCourseIds: inProgress.map(id),
});

/* Una agrupación de 8 créditos con una obligatoria de 4: el cupo optativo es
   de 4, igual que Matemática Aplicada en el plan de Matemáticas. */
const simple = context([{ key: "a", required: 8 }], [
  course("m1", "a", 4, true),
  course("e1", "a", 4, false),
  course("e2", "a", 4, false),
  course("e3", "a", 4, false),
]);

describe("excedente optativo hacia Libre Elección", () => {
  it("no genera excedente mientras quede cupo", () => {
    const [surplus] = groupingSurpluses(simple, trajectory(["e1"]));
    expect(surplus).toMatchObject({ capacity: 4, approvedSurplus: 0, inProgressSurplus: 0, contributors: [] });
  });

  it("cuenta como excedente lo aprobado por encima del cupo, aunque falte la obligatoria", () => {
    const surplus = groupingSurpluses(simple, trajectory(["e1", "e2"]))[0]!;
    expect(surplus.approvedSurplus).toBe(4);
    // La ausencia de la obligatoria no amplía el cupo optativo.
    expect(surplus.capacity).toBe(4);
    expect(surplus.contributors).toEqual([
      { versionCourseId: id("e2"), groupingId: group("a"), credits: 4, mark: "COMPLETED", surplusCredits: 4 },
    ]);
  });

  it("separa el excedente en curso del aprobado y respeta el orden Completadas primero", () => {
    const surplus = groupingSurpluses(simple, trajectory(["e2"], ["e1"]))[0]!;
    // e2 está aprobada: consume el cupo antes que e1, pese a su código mayor.
    expect(surplus).toMatchObject({ approvedSurplus: 0, inProgressSurplus: 4 });
    expect(surplus.contributors.map(entry => entry.mark)).toEqual(["IN_PROGRESS"]);
  });

  it("es determinista: el mismo conjunto marcado da el mismo excedente", () => {
    const uno = groupingSurpluses(simple, trajectory(["e1", "e2", "e3"]));
    const otro = groupingSurpluses(simple, trajectory(["e3", "e2", "e1"]));
    expect(otro).toEqual(uno);
    expect(uno[0]!.contributors.map(entry => entry.versionCourseId)).toEqual([id("e2"), id("e3")]);
  });

  it("reparte por créditos cuando una optativa queda a caballo del cupo", () => {
    // Cupo 7 con optativas de 4: la segunda aporta 3 créditos y sobra 1.
    const straddle = context([{ key: "a", required: 19 }], [
      course("m1", "a", 12, true),
      course("e1", "a", 4, false),
      course("e2", "a", 4, false),
    ]);
    const [surplus] = groupingSurpluses(straddle, trajectory(["e1", "e2"]));
    expect(surplus!.capacity).toBe(7);
    expect(surplus!.approvedSurplus).toBe(1);
    expect(surplus!.contributors).toEqual([
      { versionCourseId: id("e2"), groupingId: group("a"), credits: 4, mark: "COMPLETED", surplusCredits: 1 },
    ]);
  });

  it("mantiene bruto = reconocido + excedente, sin contar dos veces", () => {
    const current = trajectory(["m1", "e1", "e2", "e3"]);
    const progress = calculateSatisfiedPlanProgress(simple, current, 8);
    const [surplus] = groupingSurpluses(simple, current);
    const grouping = progress.components[0]!.groupings[0]!;
    expect(grouping.rawCredits).toBe(grouping.satisfiedCredits + surplus!.approvedSurplus);
    expect(grouping.excessCredits).toBe(surplus!.approvedSurplus);
  });

  it("tope del componente: no acredita de más y no esconde lo que sobra", () => {
    const wide = context([{ key: "a", required: 4 }], [
      course("e1", "a", 4, false), course("e2", "a", 4, false), course("e3", "a", 4, false),
    ]);
    const progress = calculateFreeChoiceProgress(wide, trajectory(["e1", "e2", "e3"]), 4);
    expect(progress).toMatchObject({ requiredCredits: 4, estimatedCredits: 4, projectedCredits: 4, uncountedCredits: 4 });
  });

  it("la proyección nunca convierte una materia en curso en aprobada", () => {
    const progress = calculateFreeChoiceProgress(simple, trajectory(["e1", "e2"], ["e3"]), 28);
    expect(progress.estimatedCredits).toBe(4);
    expect(progress.projectedCredits).toBe(8);
    expect(progress.uncountedCredits).toBe(0);
    expect(progress.contributors.filter(entry => entry.mark === "IN_PROGRESS")).toHaveLength(1);
  });

  it("sin excedente no hay progreso estimado de Libre Elección", () => {
    expect(calculateFreeChoiceProgress(simple, trajectory([]), 28))
      .toMatchObject({ estimatedCredits: 0, projectedCredits: 0, uncountedCredits: 0, contributors: [] });
  });

  it("reasigna al cambiar el conjunto marcado", () => {
    const antes = calculateFreeChoiceProgress(simple, trajectory(["e1", "e2"]), 28);
    const despues = calculateFreeChoiceProgress(simple, trajectory(["e1"]), 28);
    expect(antes.estimatedCredits).toBe(4);
    expect(despues.estimatedCredits).toBe(0);
  });
});
