/** Convert screen coordinates to the unzoomed SVG coordinate system. */
export function canvasPoint(x: number, y: number, left: number, top: number, scale: number) {
  const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
  return { x: (x - left) / safeScale, y: (y - top) / safeScale };
}

export function planOverviewScale(viewportWidth: number, rootFontSize: number) {
  return Math.min(1, Math.max(0.1, (viewportWidth - rootFontSize) / (64 * rootFontSize)));
}
