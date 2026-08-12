import type {
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import type { CurriculumGraph } from "./curriculum-graph";

export const EXPLORER_NODE_DIAMETER_REM = 5.5;
export const EXPLORER_LABEL_WIDTH_REM = 8.5;
export const EXPLORER_NODE_FOOTPRINT_REM = Math.max(
  EXPLORER_NODE_DIAMETER_REM,
  EXPLORER_LABEL_WIDTH_REM,
);
export const EXPLORER_MIN_AIR_REM = 0.5;
export const EXPLORER_MIN_GAP_REM =
  EXPLORER_NODE_FOOTPRINT_REM + EXPLORER_MIN_AIR_REM;
export const EXPLORER_CENTER_ATTRACTION_MAX = 0.2;

export type ExplorerLayoutConfig = {
  levelStepRem: number;
  minGapRem: number;
  staggerRem: number;
  microOffsetRem: number;
};

export const EXPLORER_LAYOUT_CONFIGS = {
  desktop: {
    levelStepRem: 16,
    minGapRem: 10.5,
    staggerRem: 1.1,
    microOffsetRem: 0.35,
  },
  tablet: {
    levelStepRem: 14,
    minGapRem: 9.5,
    staggerRem: 1.1,
    microOffsetRem: 0.3,
  },
  mobile: {
    levelStepRem: 12,
    minGapRem: EXPLORER_MIN_GAP_REM,
    staggerRem: 1.1,
    microOffsetRem: 0.25,
  },
} as const satisfies Record<string, ExplorerLayoutConfig>;

export type ExplorerNodePosition = {
  id: VersionCourseId;
  visualDepth: number;
  x: number;
  rawX: number;
  y: number;
};

export type ExplorerLayout = {
  positions: ReadonlyMap<VersionCourseId, ExplorerNodePosition>;
  maxVisualDepth: number;
  minX: number;
  maxX: number;
  height: number;
};

const CREDIT_GATE_TYPES = new Set<RequirementExpression["type"]>([
  "MIN_TOTAL_CREDITS",
  "MIN_COMPONENT_CREDITS",
  "MIN_GROUPING_CREDITS",
  "MIN_GROUPING_COURSES",
]);

export function containsCreditGate(requirement: RequirementExpression): boolean {
  if (CREDIT_GATE_TYPES.has(requirement.type)) return true;
  if (
    requirement.type === "ALL" ||
    requirement.type === "ANY" ||
    requirement.type === "AT_LEAST"
  ) {
    return requirement.children.some(containsCreditGate);
  }
  return false;
}

export function hasCourseRequirement(
  requirement: RequirementExpression,
): boolean {
  if (
    requirement.type === "COURSE_COMPLETED" ||
    requirement.type === "COURSE_COMPLETED_OR_CONCURRENT"
  ) {
    return true;
  }
  if (
    requirement.type === "ALL" ||
    requirement.type === "ANY" ||
    requirement.type === "AT_LEAST"
  ) {
    return requirement.children.some(hasCourseRequirement);
  }
  return false;
}

export function visualDepthFor(
  versionCourse: VersionCourse,
  graph: CurriculumGraph,
): number {
  const maxEdgeLevel = Math.max(0, ...graph.graphLevels.values());
  const requirement = versionCourse.requirements;
  if (
    requirement &&
    !hasCourseRequirement(requirement) &&
    containsCreditGate(requirement)
  ) {
    return maxEdgeLevel + 1;
  }
  return graph.graphLevels.get(versionCourse.id) ?? 0;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function centerOutPosition(rank: number, gap: number): number {
  if (rank === 0) return 0;
  const distance = Math.ceil(rank / 2) * gap;
  return rank % 2 === 1 ? distance : -distance;
}

function centralities(
  courses: readonly VersionCourse[],
  graph: CurriculumGraph,
): ReadonlyMap<VersionCourseId, number> {
  const outgoing = new Map<VersionCourseId, VersionCourseId[]>();
  for (const course of courses) outgoing.set(course.id, []);
  for (const edge of graph.edges) {
    outgoing.get(edge.sourceId)?.push(edge.targetId);
  }

  return new Map(
    courses.map((course) => {
      const reached = new Set<VersionCourseId>();
      const pending = [...(outgoing.get(course.id) ?? [])];
      while (pending.length > 0) {
        const id = pending.pop();
        if (!id || reached.has(id)) continue;
        reached.add(id);
        pending.push(...(outgoing.get(id) ?? []));
      }
      return [
        course.id,
        reached.size + (outgoing.get(course.id)?.length ?? 0),
      ];
    }),
  );
}

export function separateLayerPositions<T extends { rawX: number }>(
  nodes: readonly T[],
  minGap: number,
): Array<T & { x: number }> {
  const ordered = nodes
    .map((node, inputOrder) => ({ node, inputOrder }))
    .sort(
      (left, right) =>
        left.node.rawX - right.node.rawX || left.inputOrder - right.inputOrder,
    );
  const separated = ordered.map(({ node }, index) => ({
    ...node,
    x:
      index === 0
        ? node.rawX
        : Math.max(
            node.rawX,
            (ordered[index - 1]?.node.rawX ?? node.rawX) + minGap,
          ),
  }));

  for (let index = 1; index < separated.length; index += 1) {
    const previous = separated[index - 1];
    const current = separated[index];
    if (previous && current && current.x - previous.x < minGap) {
      current.x = previous.x + minGap;
    }
  }

  if (separated.length === 0) return separated;
  const displacement =
    separated.reduce((sum, node) => sum + node.x - node.rawX, 0) /
    separated.length;
  return separated.map((node) => ({ ...node, x: node.x - displacement }));
}

export function buildExplorerLayout(
  courses: readonly VersionCourse[],
  graph: CurriculumGraph,
  config: ExplorerLayoutConfig,
): ExplorerLayout {
  if (config.staggerRem > config.levelStepRem * 0.1) {
    throw new Error("Explorer stagger must not exceed 10% of the level step");
  }
  if (config.minGapRem < EXPLORER_NODE_FOOTPRINT_REM) {
    throw new Error("Explorer gap must contain the complete node footprint");
  }

  const depthById = new Map(
    courses.map((course) => [course.id, visualDepthFor(course, graph)]),
  );
  const coursesByDepth = new Map<number, VersionCourse[]>();
  for (const course of courses) {
    const depth = depthById.get(course.id) ?? 0;
    coursesByDepth.set(depth, [...(coursesByDepth.get(depth) ?? []), course]);
  }

  const predecessors = new Map<VersionCourseId, VersionCourseId[]>();
  for (const course of courses) predecessors.set(course.id, []);
  for (const edge of graph.edges) {
    predecessors.get(edge.targetId)?.push(edge.sourceId);
  }

  const importance = centralities(courses, graph);
  const maximumCentrality = Math.max(1, ...importance.values());
  const positions = new Map<VersionCourseId, ExplorerNodePosition>();
  const depths = [...coursesByDepth.keys()].sort((left, right) => left - right);

  for (const depth of depths) {
    const layer = coursesByDepth.get(depth) ?? [];
    const roots = [...layer].sort((left, right) => {
      const centralityDifference =
        (importance.get(right.id) ?? 0) - (importance.get(left.id) ?? 0);
      return (
        centralityDifference ||
        left.academicCode.localeCompare(right.academicCode)
      );
    });
    const rawNodes = (depth === 0 ? roots : layer).map((course, index) => {
      const predecessorPositions = (predecessors.get(course.id) ?? [])
        .map((id) => positions.get(id)?.x)
        .filter((x): x is number => x !== undefined);
      const barycenter =
        depth === 0
          ? centerOutPosition(index, config.minGapRem)
          : predecessorPositions.length > 0
            ? predecessorPositions.reduce((sum, x) => sum + x, 0) /
              predecessorPositions.length
            : 0;
      const attraction =
        EXPLORER_CENTER_ATTRACTION_MAX *
        ((importance.get(course.id) ?? 0) / maximumCentrality);
      const microOffset =
        ((stableHash(course.academicCode) % 5) - 2) * config.microOffsetRem;
      return {
        course,
        rawX: barycenter * (1 - attraction) + microOffset,
      };
    });

    for (const node of separateLayerPositions(rawNodes, config.minGapRem)) {
      const staggerBucket = stableHash(node.course.academicCode) % 3;
      positions.set(node.course.id, {
        id: node.course.id,
        visualDepth: depth,
        x: node.x,
        rawX: node.rawX,
        y:
          depth * config.levelStepRem +
          (staggerBucket - 1) * config.staggerRem,
      });
    }
  }

  const xValues = [...positions.values()].map(({ x }) => x);
  const maxVisualDepth = Math.max(0, ...depths);
  return {
    positions,
    maxVisualDepth,
    minX: Math.min(0, ...xValues),
    maxX: Math.max(0, ...xValues),
    height:
      maxVisualDepth * config.levelStepRem +
      config.staggerRem +
      EXPLORER_NODE_DIAMETER_REM,
  };
}
