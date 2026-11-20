import { panoramicScale, type PanoramaFrame } from "./display-geometry";

export type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
export type CameraBounds = { width: number; height: number; contentWidth: number; contentHeight: number; minScale: number; maxScale: number };

export function constrainCamera(camera: Camera, bounds: CameraBounds): Camera {
  const scale = Math.max(bounds.minScale, Math.min(bounds.maxScale, camera.scale));
  const axis = (position: number, available: number, content: number, center: boolean) =>
    content * scale <= available ? (center ? (available - content * scale) / 2 : 0)
      : Math.min(0, Math.max(available - content * scale, position));
  return { scale, x: axis(camera.x, bounds.width, bounds.contentWidth, true), y: axis(camera.y, bounds.height, bounds.contentHeight, false) };
}

export function frameCamera(size: Omit<CameraBounds, "minScale" | "maxScale">, fullView: boolean, frame: PanoramaFrame, rootFontSize: number) {
  const scale = fullView ? panoramicScale(size.width, size.contentWidth, rootFontSize, frame) : 1;
  const bounds: CameraBounds = { ...size, minScale: Math.min(scale, size.width / size.contentWidth, size.height / size.contentHeight), maxScale: 3 };
  return { bounds, camera: constrainCamera({ scale, x: frame === "desktop-window" ? (size.width - size.contentWidth * scale) / 2 : 0, y: 0 }, bounds) };
}

/** The world point under anchor stays under destination, unless a boundary is reached. */
export function zoomCamera(camera: Camera, scale: number, anchor: Point, bounds: CameraBounds, destination = anchor): Camera {
  const nextScale = Math.max(bounds.minScale, Math.min(bounds.maxScale, scale));
  const ratio = nextScale / camera.scale;
  return constrainCamera({ scale: nextScale, x: destination.x - (anchor.x - camera.x) * ratio, y: destination.y - (anchor.y - camera.y) * ratio }, bounds);
}

export function revealInCamera(camera: Camera, box: { x: number; y: number; width: number; height: number }, bounds: CameraBounds): Camera {
  const scale = Math.min(bounds.maxScale, Math.max(camera.scale, Math.min(1, (bounds.width - 24) / box.width, (bounds.height - 24) / box.height)));
  return constrainCamera({ scale, x: bounds.width / 2 - (box.x + box.width / 2) * scale, y: bounds.height / 2 - (box.y + box.height / 2) * scale }, bounds);
}

/** Pointer membership changes rebase the gesture, preserving the current camera. */
export class CameraGesture {
  private points = new Map<number, Point>();
  private origin: Point[] = [];
  private base: Camera = { x: 0, y: 0, scale: 1 };
  suppressClick = false;

  private rebase(camera: Camera) { this.base = camera; this.origin = [...this.points.values()]; }
  down(id: number, point: Point, camera: Camera) {
    if (this.points.size === 0) this.suppressClick = false;
    this.points.set(id, point);
    if (this.points.size > 1) this.suppressClick = true;
    this.rebase(camera);
  }
  move(id: number, point: Point, camera: Camera, bounds: CameraBounds): Camera {
    if (!this.points.has(id)) return camera;
    this.points.set(id, point);
    const current = [...this.points.values()];
    const first = current[0]; const start = this.origin[0];
    if (!first || !start) return camera;
    if (current.length === 1) {
      const dx = first.x - start.x; const dy = first.y - start.y;
      if (!this.suppressClick && Math.hypot(dx, dy) <= 5) return camera;
      this.suppressClick = true;
      return constrainCamera({ ...this.base, x: this.base.x + dx, y: this.base.y + dy }, bounds);
    }
    const second = current[1]; const secondStart = this.origin[1];
    if (!second || !secondStart) return camera;
    const distance = Math.hypot(secondStart.x - start.x, secondStart.y - start.y);
    if (distance < 1) { this.rebase(camera); return camera; }
    return zoomCamera(this.base, this.base.scale * Math.hypot(second.x - first.x, second.y - first.y) / distance,
      { x: (start.x + secondStart.x) / 2, y: (start.y + secondStart.y) / 2 }, bounds,
      { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
  }
  up(id: number, camera: Camera, cancelled = false) {
    if (!this.points.has(id)) return;
    if (cancelled) this.suppressClick = true;
    this.points.delete(id); this.rebase(camera);
  }
  clear() { this.points.clear(); this.origin = []; this.suppressClick = false; }
}
