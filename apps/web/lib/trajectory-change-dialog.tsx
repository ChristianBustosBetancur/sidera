"use client";

import type { TrajectoryReconciliation } from "@sidera/curriculum-engine";
import { useEffect, useRef } from "react";
import { groupImpacts, type ImpactItem } from "./trajectory-impact-groups";
import styles from "./trajectory-change-dialog.module.css";

/* Cuántos impactos se listan por sección antes de resumir el resto. Una
   edición puede alcanzar decenas de materias; un listado sin límite sería
   ilegible, pero ocultar cuántas hay sería peor: el total siempre se anuncia
   en el encabezado de la sección. */
const VISIBLE_IMPACTS = 5;

function ImpactSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: readonly ImpactItem[];
}) {
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE_IMPACTS);
  const remaining = items.length - visible.length;

  return (
    <section className={styles.group}>
      <h3>
        {title}
        <span className={styles.count}>
          {items.length} {items.length === 1 ? "materia" : "materias"}
        </span>
      </h3>
      <p className={styles.groupNote}>{description}</p>
      <ul className={styles.impacts}>
        {visible.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>
            {item.reasons.length > 0 ? (
              <span>{item.reasons.join(". ")}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <p className={styles.remaining}>
          y {remaining} {remaining === 1 ? "materia más" : "materias más"}
        </p>
      ) : null}
    </section>
  );
}

export function TrajectoryChangeDialog({
  reconciliation,
  onConfirm,
  onCancel,
}: {
  reconciliation: TrajectoryReconciliation;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /* El foco entra en Confirmar: es la acción que el usuario venía a hacer, y
       Escape o Cancelar siguen a un tabulador de distancia. */
    confirmRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      /* Retención de foco mínima: solo hay dos botones, así que basta con
         hacer circular el tabulador entre el primero y el último. */
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll("button");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onCancel]);

  const { requestedName, requestedMark, direct, cascade } =
    groupImpacts(reconciliation);

  return (
    <>
      <div className={styles.overlay} onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trajectory-change-title"
      >
        <h2 id="trajectory-change-title">Este cambio afectará tu trayectoria</h2>

        {/* Punto de partida siempre visible: con una cascada larga es fácil
            perder de vista qué acción la originó. */}
        <p className={styles.requested}>
          <strong>{requestedName}</strong>
          <span aria-hidden="true">→</span>
          <span className={styles.requestedMark}>{requestedMark}</span>
        </p>

        <ImpactSection
          title="Impacto directo"
          description="Dejan de cumplir sus requisitos por este cambio y se retirarán de «En curso»."
          items={direct}
        />

        <ImpactSection
          title="Impacto en cascada"
          description="Se retirarán como consecuencia de las anteriores."
          items={cascade}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
          >
            Aplicar cambio
          </button>
        </div>
      </div>
    </>
  );
}
