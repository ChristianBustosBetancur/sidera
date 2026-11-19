"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createGestureGuidance } from "./gesture-guidance-state";
import styles from "./gesture-guidance.module.css";

const GuidanceContext = createContext<ReturnType<typeof createGestureGuidance> | null>(null);
const serverSnapshot = () => false;

export function GestureGuidanceProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => createGestureGuidance(() => window.sessionStorage));
  return <GuidanceContext.Provider value={controller}>{children}</GuidanceContext.Provider>;
}

export function GraphGestureHelp() {
  const controller = useContext(GuidanceContext);
  if (!controller) throw new Error("GraphGestureHelp requires GestureGuidanceProvider");
  const visible = useSyncExternalStore(controller.subscribe, controller.getSnapshot, serverSnapshot);
  const [pertinent, setPertinent] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 76rem), (pointer: coarse)");
    const update = () => {
      setPertinent(media.matches);
      if (media.matches) controller.showAutomatically();
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [controller]);
  if (!pertinent) return null;
  return (
    <div className={styles.help}>
      <button type="button" className={styles.button} onClick={controller.show} aria-label="Cómo explorar el mapa">?</button>
      <div className={styles.notice} data-visible={visible} aria-hidden={!visible} role="status">
        <div>
          <p><span aria-hidden="true">↔</span> <strong>Explora con dos dedos</strong></p>
          <p>Pellizca para acercar o alejar. Desliza para recorrer el mapa.</p>
        </div>
      </div>
    </div>
  );
}
