"use client";

import { useLayoutEffect, type RefObject } from "react";

type VisibleViewport = { offsetLeft: number; offsetTop: number; width: number; height: number };
export function sheetBounds(layoutHeight: number, viewport: VisibleViewport) {
  return {
    left: Math.max(0, viewport.offsetLeft),
    bottom: Math.max(0, layoutHeight - viewport.offsetTop - viewport.height),
    width: viewport.width,
    height: viewport.height,
  };
}

/** Reflow inside the visible viewport. Font sizes and native zoom stay intact. */
export function useVisibleSheet(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!enabled || !panel) return;
    const update = () => {
      const bounds = sheetBounds(window.innerHeight, window.visualViewport ?? {
        offsetLeft: 0, offsetTop: 0, width: document.documentElement.clientWidth, height: window.innerHeight,
      });
      for (const [key, value] of Object.entries(bounds)) panel.style.setProperty(`--sheet-${key}`, `${value}px`);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      for (const key of ["left", "bottom", "width", "height"]) panel.style.removeProperty(`--sheet-${key}`);
    };
  }, [ref, enabled]);
}
