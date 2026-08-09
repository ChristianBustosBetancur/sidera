"use client";

import type { VersionCourseId } from "@sidera/curriculum-domain";
import {
  deriveVersionCourseState,
  type DerivedCourseState,
  type StudentTrajectory,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { evaluationContext } from "./curriculum-data";

export type Mark = "UNMARKED" | "IN_PROGRESS" | "COMPLETED";

const EMPTY_TRAJECTORY: StudentTrajectory = {
  completedVersionCourseIds: [],
  inProgressVersionCourseIds: [],
};

type TrajectoryContextValue = {
  trajectory: StudentTrajectory;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  markCourse: (versionCourseId: VersionCourseId, mark: Mark) => void;
};

const TrajectoryContext = createContext<TrajectoryContextValue | undefined>(
  undefined,
);

export function TrajectoryProvider({ children }: { children: ReactNode }) {
  const [trajectory, setTrajectory] =
    useState<StudentTrajectory>(EMPTY_TRAJECTORY);

  const states = useMemo(
    () =>
      new Map(
        unalCs2024Official.versionCourses.map((versionCourse) => [
          versionCourse.id,
          deriveVersionCourseState(
            versionCourse.id,
            evaluationContext,
            trajectory,
          ).state,
        ]),
      ),
    [trajectory],
  );

  function markCourse(versionCourseId: VersionCourseId, mark: Mark) {
    setTrajectory((current) => ({
      completedVersionCourseIds:
        mark === "COMPLETED"
          ? [
              ...current.completedVersionCourseIds.filter(
                (id) => id !== versionCourseId,
              ),
              versionCourseId,
            ]
          : current.completedVersionCourseIds.filter(
              (id) => id !== versionCourseId,
            ),
      inProgressVersionCourseIds:
        mark === "IN_PROGRESS"
          ? [
              ...current.inProgressVersionCourseIds.filter(
                (id) => id !== versionCourseId,
              ),
              versionCourseId,
            ]
          : current.inProgressVersionCourseIds.filter(
              (id) => id !== versionCourseId,
            ),
    }));
  }

  return (
    <TrajectoryContext.Provider value={{ trajectory, states, markCourse }}>
      {children}
    </TrajectoryContext.Provider>
  );
}

export function useTrajectory(): TrajectoryContextValue {
  const context = useContext(TrajectoryContext);
  if (!context) {
    throw new Error("useTrajectory must be used within TrajectoryProvider");
  }
  return context;
}
