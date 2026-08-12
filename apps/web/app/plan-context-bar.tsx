"use client";

import { calculateSatisfiedPlanProgress } from "@sidera/curriculum-engine";
import { unalCs2024Official } from "@sidera/curriculum-snapshot";
import { useMemo } from "react";
import {
  evaluationContext,
  progressBarPresentation,
  satisfiedProgressBarArguments,
} from "../lib/curriculum-data";
import { useTrajectory } from "../lib/trajectory";
import styles from "./plan-context-bar.module.css";

/* Barra de contexto académico del shell. No calcula nada por su cuenta: toda
   la aritmética curricular viene del engine y de los helpers que ya usa la
   Vista Plan, así que no existe una segunda fuente de verdad ni una segunda
   definición de "completado".

   Semántica, que es la que ya trae el engine y NO se altera aquí:
     · `satisfiedCredits`            -> créditos realmente aprobados;
     · `projectedSatisfiedCredits`   -> lo anterior MÁS lo que se aprobaría si
                                        se superara lo que está en curso.
   `satisfiedProgressBarArguments` deriva los créditos en curso como la
   diferencia entre ambos, de modo que lo IN_PROGRESS nunca infla el porcentaje
   principal: se comunica aparte. */
export function PlanContextBar() {
  const { trajectory } = useTrajectory();

  /* Mismo cálculo y mismas dependencias que la Vista Plan: se rehace solo
     cuando cambia la trayectoria, no en cada render del shell. */
  const presentation = useMemo(() => {
    const progress = calculateSatisfiedPlanProgress(
      evaluationContext,
      trajectory,
      unalCs2024Official.planVersion.requiredCredits,
    );
    return {
      ...progressBarPresentation(
        satisfiedProgressBarArguments(progress, progress.requiredCredits),
      ),
      completedCredits: progress.satisfiedCredits,
      requiredCredits: progress.requiredCredits,
      inProgressCredits: Math.max(
        progress.projectedSatisfiedCredits - progress.satisfiedCredits,
        0,
      ),
    };
  }, [trajectory]);

  return (
    <section className={styles.bar} aria-label="Contexto y progreso del plan">
      <p className={styles.context}>
        <strong>{unalCs2024Official.academicProgram.name}</strong>
        <span aria-hidden="true"> · </span>
        <span className={styles.planName}>
          {unalCs2024Official.planVersion.name}
        </span>
      </p>

      <div className={styles.progress}>
        {/* Texto primero: el progreso se entiende sin ver la barra y sin
            depender del color. */}
        <p className={styles.credits}>
          <strong>
            {presentation.completedCredits} / {presentation.requiredCredits}
          </strong>{" "}
          créditos completados
          {/* En una sola línea: partirlo hacía que JSX emitiera el signo como
              nodo hermano y el porcentaje se leyera "63 %". */}
          <span className={styles.percent}>{`${presentation.completedPercent}%`}</span>
        </p>

        {/* La barra representa SOLO lo completado. Lo que está en curso se
            enuncia aparte, nunca dentro del relleno. */}
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={presentation.completedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={presentation.ariaLabel}
        >
          <span
            className={styles.fill}
            style={{ width: `${presentation.completedPercent}%` }}
          />
        </div>

        {/* Si no hay nada en curso el fragmento no se renderiza: un "0 en
            curso" sería ruido. */}
        {presentation.inProgressCredits > 0 ? (
          <p className={styles.inProgress}>
            {presentation.inProgressCredits} créditos en curso
          </p>
        ) : null}
      </div>
    </section>
  );
}
