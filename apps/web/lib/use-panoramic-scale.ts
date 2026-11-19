"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { panoramicScale, type PanoramaFrame } from "./display-geometry";

/** Measure the viewport and intrinsic layout separately; never relayout nodes. */
export function usePanoramicScale(
  regionRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  frame: PanoramaFrame,
) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const region = regionRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !region || !canvas) return;
    const measure = () => {
      const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setScale(panoramicScale(region.clientWidth, canvas.offsetWidth, rootFont, frame));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [regionRef, canvasRef, enabled, frame]);
  return enabled ? scale : 1;
}
