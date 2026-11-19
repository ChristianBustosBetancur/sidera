"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { planOverviewScale } from "./display-geometry";

const DisplayModeContext = createContext({
  fullView: false,
  planScale: 1,
  toggle: () => {},
});
const STORAGE_KEY = "sidera:full-view:v1";

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [preferred, setPreferred] = useState(false);
  const [compact, setCompact] = useState(false);
  const [planScale, setPlanScale] = useState(1);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 64rem)");
    const update = () => {
      setCompact(media.matches);
      setPlanScale(planOverviewScale(
        document.documentElement.clientWidth,
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      ));
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    try {
      setPreferred(localStorage.getItem(STORAGE_KEY) === "true");
    } catch { /* Storage is optional. */ }
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const toggle = () => {
    const next = !preferred;
    setPreferred(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch { /* In-memory navigation still works. */ }
    // Geometry changes can leave the document below its new content height.
    // Keep selection, filters and panels mounted, and return to a known frame.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  return (
    <DisplayModeContext.Provider value={{ fullView: preferred && compact, planScale, toggle }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
