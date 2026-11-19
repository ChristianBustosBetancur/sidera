/** Convert screen coordinates to the unzoomed SVG coordinate system. */
export function canvasPoint(x: number, y: number, left: number, top: number, scale: number) {
  const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
  return { x: (x - left) / safeScale, y: (y - top) / safeScale };
}

export function planOverviewScale(viewportWidth: number, rootFontSize: number) {
  return Math.min(1, Math.max(0.1, (viewportWidth - rootFontSize) / (64 * rootFontSize)));
}

export type PanoramaFrame = "all-columns" | "desktop-window";

export function panoramicScale(availableWidth: number, canvasWidth: number, rootFontSize: number, frame: PanoramaFrame) {
  if (availableWidth <= 0 || canvasWidth <= 0 || rootFontSize <= 0) return 1;
  // The map fits its complete measured canvas. The tree exposes the same 92rem
  // working width as its desktop composition, retaining horizontal exploration.
  const virtualWidth = frame === "all-columns" ? canvasWidth : Math.min(canvasWidth, 92 * rootFontSize);
  return Math.min(1, availableWidth / virtualWidth);
}
