"use client";

import { ModalShell } from "./dialog-shell";
import styles from "./trajectory-change-dialog.module.css";

const titleId = "dual-deactivation-title";
const summaryId = "dual-deactivation-summary";

/* Desactivar no es destructivo —`deactivateDual` solo baja el indicador— pero
   sí cambia cómo se comportarán los próximos cambios, así que se confirma. */
export function DualDeactivationDialog({ programId, onConfirm, onCancel }: {
  programId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <ModalShell programId={programId} labelledBy={titleId} describedBy={summaryId} onCancel={onCancel}>
    <h2 id={titleId}>Desactivar Doble Titulación</h2>
    <p id={summaryId}>Desactivar no borra tu progreso. Desde ese momento, cada programa evoluciona por separado.</p>
    <div className={styles.actions}>
      <button className={styles.cancel} onClick={onCancel}>Cancelar</button>
      <button className={styles.confirm} onClick={onConfirm}>Desactivar</button>
    </div>
  </ModalShell>;
}
