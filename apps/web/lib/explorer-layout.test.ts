import type {
  RequirementExpression,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { describe, expect, it } from "vitest";
import { buildCurriculumGraph } from "./curriculum-graph";
import {
  buildExplorerLayout,
  EXPLORER_LAYOUT_CONFIGS,
  EXPLORER_NODE_DIAMETER_REM,
  EXPLORER_NODE_FOOTPRINT_REM,
  EXPLORER_LABEL_WIDTH_REM,
  EXPLORER_MIN_AIR_REM,
  EXPLORER_MIN_GAP_REM,
  separateLayerPositions,
  visualDepthFor,
} from "./explorer-layout";

const graph = buildCurriculumGraph(unalCs2024Official.versionCourses);

describe("explorer layout", () => {
  it("uses the label-aware footprint for collision separation", () => {
    expect(EXPLORER_NODE_FOOTPRINT_REM).toBe(
      Math.max(EXPLORER_NODE_DIAMETER_REM, EXPLORER_LABEL_WIDTH_REM),
    );
    expect(EXPLORER_MIN_GAP_REM).toBe(
      EXPLORER_NODE_FOOTPRINT_REM + EXPLORER_MIN_AIR_REM,
    );

    for (const config of Object.values(EXPLORER_LAYOUT_CONFIGS)) {
      const layout = buildExplorerLayout(
        unalCs2024Official.versionCourses,
        graph,
        config,
      );
      const layers = new Map<number, number[]>();
      for (const position of layout.positions.values()) {
        layers.set(position.visualDepth, [
          ...(layers.get(position.visualDepth) ?? []),
          position.x,
        ]);
      }
      for (const xs of layers.values()) {
        xs.sort((left, right) => left - right);
        for (let index = 1; index < xs.length; index += 1) {
          expect((xs[index] ?? 0) - (xs[index - 1] ?? 0)).toBeGreaterThanOrEqual(
            config.minGapRem - 1e-9,
          );
        }
      }
    }
  });

  it("lays out the complete real DAG with seven independent roots", () => {
    const layout = buildExplorerLayout(
      unalCs2024Official.versionCourses,
      graph,
      EXPLORER_LAYOUT_CONFIGS.desktop,
    );
    const roots = unalCs2024Official.versionCourses.filter(
      (course) => layout.positions.get(course.id)?.visualDepth === 0,
    );

    expect(layout.positions).toHaveLength(60);
    expect(graph.edges).toHaveLength(73);
    expect(roots).toHaveLength(7);
    const rootIds = new Set(roots.map(({ id }) => id));
    expect(
      graph.edges.some(
        (edge) => rootIds.has(edge.sourceId) && rootIds.has(edge.targetId),
      ),
    ).toBe(false);
  });

  it("moves a course-independent credit gate to the final visual depth", () => {
    const degreeWork = unalCs2024Official.versionCourses.find(
      ({ academicCode }) => academicCode === "3010664",
    );
    expect(degreeWork).toBeDefined();
    expect(graph.graphLevels.get(degreeWork?.id as VersionCourseId)).toBe(0);
    expect(visualDepthFor(degreeWork as VersionCourse, graph)).toBe(6);
    expect(
      graph.edges.filter(
        (edge) => edge.sourceId === degreeWork?.id || edge.targetId === degreeWork?.id,
      ),
    ).toHaveLength(0);
  });

  it("does not isolate a mixed credit and course requirement", () => {
    const base = unalCs2024Official.versionCourses[0] as VersionCourse;
    const requirement: RequirementExpression = {
      type: "ALL",
      children: [
        { type: "MIN_TOTAL_CREDITS", credits: 20 },
        { type: "COURSE_COMPLETED", versionCourseId: base.id },
      ],
    };
    const mixed = {
      ...unalCs2024Official.versionCourses[1],
      requirements: requirement,
    } as VersionCourse;
    const mixedGraph = buildCurriculumGraph([base, mixed]);
    expect(visualDepthFor(mixed, mixedGraph)).toBe(1);
  });

  it("preserves raw left-to-right order while separating collisions", () => {
    const separated = separateLayerPositions(
      [
        { id: "right", rawX: 0.2 },
        { id: "left", rawX: 0 },
        { id: "middle", rawX: 0.1 },
      ],
      EXPLORER_NODE_FOOTPRINT_REM,
    );
    expect(separated.map(({ id }) => id)).toEqual(["left", "middle", "right"]);
    expect(separated[1]!.x - separated[0]!.x).toBeGreaterThanOrEqual(
      EXPLORER_NODE_FOOTPRINT_REM,
    );
    expect(separated[2]!.x - separated[1]!.x).toBeGreaterThanOrEqual(
      EXPLORER_NODE_FOOTPRINT_REM,
    );
  });

  it("keeps deterministic stagger at or below ten percent of every level step", () => {
    for (const config of Object.values(EXPLORER_LAYOUT_CONFIGS)) {
      expect(config.staggerRem).toBeLessThanOrEqual(config.levelStepRem * 0.1);
      const first = buildExplorerLayout(
        unalCs2024Official.versionCourses,
        graph,
        config,
      );
      const second = buildExplorerLayout(
        unalCs2024Official.versionCourses,
        graph,
        config,
      );
      expect([...first.positions.values()]).toEqual([...second.positions.values()]);
    }
  });
});
