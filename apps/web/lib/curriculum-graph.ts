import type {
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";

export type CourseEdge = {
  sourceId: VersionCourseId;
  targetId: VersionCourseId;
  type: "PREREQUISITE" | "COREQUISITE";
};

export type CurriculumGraph = {
  edges: readonly CourseEdge[];
  graphLevels: ReadonlyMap<VersionCourseId, number>;
  cycles: readonly (readonly VersionCourseId[])[];
};

function requirementEdges(
  targetId: VersionCourseId,
  requirement: RequirementExpression,
): CourseEdge[] {
  switch (requirement.type) {
    case "COURSE_COMPLETED":
      return [
        {
          sourceId: requirement.versionCourseId,
          targetId,
          type: "PREREQUISITE",
        },
      ];
    case "COURSE_COMPLETED_OR_CONCURRENT":
      return [
        {
          sourceId: requirement.versionCourseId,
          targetId,
          type: "COREQUISITE",
        },
      ];
    case "ALL":
    case "ANY":
    case "AT_LEAST":
      return requirement.children.flatMap((child) =>
        requirementEdges(targetId, child),
      );
    case "MIN_TOTAL_CREDITS":
    case "MIN_COMPONENT_CREDITS":
    case "MIN_GROUPING_CREDITS":
    case "MIN_GROUPING_COURSES":
      return [];
  }
}

export function buildCurriculumGraph(
  versionCourses: readonly VersionCourse[],
): CurriculumGraph {
  const knownIds = new Set(versionCourses.map(({ id }) => id));
  const edges = versionCourses.flatMap((versionCourse) =>
    versionCourse.requirements
      ? requirementEdges(versionCourse.id, versionCourse.requirements)
      : [],
  );
  const dependenciesById = new Map<VersionCourseId, VersionCourseId[]>();

  for (const versionCourse of versionCourses) {
    dependenciesById.set(versionCourse.id, []);
  }
  for (const edge of edges) {
    if (knownIds.has(edge.sourceId)) {
      dependenciesById.get(edge.targetId)?.push(edge.sourceId);
    }
  }

  const graphLevels = new Map<VersionCourseId, number>();
  const visiting = new Set<VersionCourseId>();
  const path: VersionCourseId[] = [];
  const cycleKeys = new Set<string>();
  const cycles: VersionCourseId[][] = [];

  function deriveGraphLevel(id: VersionCourseId): number {
    const cached = graphLevels.get(id);
    if (cached !== undefined) return cached;

    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start), id];
      const key = [...new Set(cycle)].sort().join("|");
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }
      return 0;
    }

    visiting.add(id);
    path.push(id);
    const dependencies = dependenciesById.get(id) ?? [];
    const level =
      dependencies.length === 0
        ? 0
        : 1 + Math.max(...dependencies.map(deriveGraphLevel));
    path.pop();
    visiting.delete(id);
    graphLevels.set(id, level);
    return level;
  }

  for (const versionCourse of versionCourses) {
    deriveGraphLevel(versionCourse.id);
  }

  return { edges, graphLevels, cycles };
}
