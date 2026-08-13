"use client";

import type { VersionCourseId } from "@sidera/curriculum-domain";
import {
  deriveVersionCourseState,
  type DerivedCourseState,
  reconcileTrajectory,
  type StudentTrajectory,
  type TrajectoryReconciliation,
} from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { evaluationContext } from "./curriculum-data";
import { TrajectoryChangeDialog } from "./trajectory-change-dialog";
import { loadTrajectory, saveTrajectory } from "./trajectory-storage";

export type Mark = "UNMARKED" | "IN_PROGRESS" | "COMPLETED";

const EMPTY_TRAJECTORY: StudentTrajectory = {
  completedVersionCourseIds: [],
  inProgressVersionCourseIds: [],
};

type TrajectoryContextValue = {
  trajectory: StudentTrajectory;
  states: ReadonlyMap<VersionCourseId, DerivedCourseState>;
  /* Punto de entrada único para cambiar una marca. Si el cambio no retira
     ninguna materia en curso se aplica al instante; si retira alguna, queda
     pendiente de confirmación y el propio proveedor muestra el diálogo. Las
     vistas no necesitan saber cuál de los dos casos ocurrió. */
  markCourse: (
    versionCourseId: VersionCourseId,
    mark: Mark,
  ) => TrajectoryReconciliation;
  /* Mismo cálculo sin mutar nada: permite anticipar el impacto de un cambio
     —por ejemplo para pedir confirmación— antes de aplicarlo. */
  previewMarkCourse: (
    versionCourseId: VersionCourseId,
    mark: Mark,
  ) => TrajectoryReconciliation;
};

const TrajectoryContext = createContext<TrajectoryContextValue | undefined>(
  undefined,
);

export function TrajectoryProvider({ children }: { children: ReactNode }) {
  const [trajectory, setTrajectory] =
    useState<StudentTrajectory>(EMPTY_TRAJECTORY);
  const [hasLoadedStoredTrajectory, setHasLoadedStoredTrajectory] =
    useState(false);
  /* Cambio previsualizado a la espera de confirmación. Mientras exista, el
     diálogo bloquea la interacción, de modo que la trayectoria no puede
     moverse por debajo y el resultado guardado sigue siendo válido. */
  const [pendingChange, setPendingChange] =
    useState<TrajectoryReconciliation | null>(null);

  useEffect(() => {
    setTrajectory(loadTrajectory());
    setHasLoadedStoredTrajectory(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredTrajectory) {
      return;
    }

    saveTrajectory(trajectory);
  }, [hasLoadedStoredTrajectory, trajectory]);

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

  /* Toda la aritmética curricular vive en el engine: aquí no se decide qué
     materias dejan de ser válidas, solo se guarda el resultado. */
  function previewMarkCourse(
    versionCourseId: VersionCourseId,
    mark: Mark,
  ): TrajectoryReconciliation {
    return reconcileTrajectory(
      { versionCourseId, mark },
      evaluationContext,
      trajectory,
    );
  }

  function markCourse(
    versionCourseId: VersionCourseId,
    mark: Mark,
  ): TrajectoryReconciliation {
    const reconciliation = previewMarkCourse(versionCourseId, mark);
    /* Solo se pide confirmación cuando el cambio RETIRA materias en curso. Las
       incoherencias históricas que el engine detecta sobre materias aprobadas
       no se retiran ni se pierden, así que interrumpir por ellas sería fricción
       sin decisión que tomar: el cambio se aplica igual que uno normal. */
    if (reconciliation.invalidations.length === 0) {
      setTrajectory(reconciliation.nextTrajectory);
      return reconciliation;
    }
    /* Se guarda la reconciliación COMPLETA, no la intención. Al confirmar se
       aplica su `nextTrajectory` tal cual, sin recalcular: así el usuario
       obtiene exactamente el resultado que se le mostró. */
    setPendingChange(reconciliation);
    return reconciliation;
  }

  return (
    <TrajectoryContext.Provider
      value={{ trajectory, states, markCourse, previewMarkCourse }}
    >
      {children}
      {/* El diálogo vive junto al estado que confirma, no en cada vista: las
          tres superficies que permiten marcar materias lo obtienen sin
          implementar nada. */}
      {pendingChange ? (
        <TrajectoryChangeDialog
          reconciliation={pendingChange}
          onConfirm={() => {
            setTrajectory(pendingChange.nextTrajectory);
            setPendingChange(null);
          }}
          onCancel={() => setPendingChange(null)}
        />
      ) : null}
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
