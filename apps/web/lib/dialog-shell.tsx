"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./trajectory-change-dialog.module.css";

/* Envoltura modal compartida por los diálogos de Doble Titulación. Existe para
   que activación y desactivación no repitan la trampa de foco: el
   comportamiento accesible es exactamente el mismo que ya tenía el diálogo de
   cambios académicos, movido aquí sin alterarlo.

   `labelledBy` apunta al título y `describedBy` al resumen, de modo que al
   abrir se anuncien el título y los conteos, no solo el primero. */
export function ModalShell({ programId, labelledBy, describedBy, onCancel, children }: {
  programId: string;
  labelledBy: string;
  describedBy?: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
      if (event.key !== "Tab") return;
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select');
      const first = elements?.[0];
      const last = elements?.[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onCancel]);
  return <div data-program={programId}>
    <div className={styles.overlay} onClick={onCancel} aria-hidden="true" />
    <div ref={ref} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {children}
    </div>
  </div>;
}
