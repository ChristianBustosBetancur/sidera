import { describe, expect, it } from "vitest";
import { CameraGesture, constrainCamera, frameCamera, revealInCamera, zoomCamera, type CameraBounds } from "./graph-camera";

const bounds: CameraBounds = { width: 400, height: 600, contentWidth: 2000, contentHeight: 4000, minScale: .1, maxScale: 3 };
const camera = { x: -400, y: -800, scale: 1 };

describe("graph camera", () => {
  it("retains six-column map and 92rem tree initial panoramas", () => {
    const map = frameCamera(bounds, true, "all-columns", 16);
    expect(map.camera).toEqual({ x: 0, y: 0, scale: .2 });
    const tree = frameCamera(bounds, true, "desktop-window", 16);
    expect(tree.camera.scale).toBeCloseTo(400 / 1472);
    expect(tree.camera.x).toBeCloseTo((400 - 2000 * tree.camera.scale) / 2);
    expect(frameCamera(bounds, false, "all-columns", 16).camera.scale).toBe(1);
  });
  it("clamps scale and pan to bounds, centers narrow content", () => {
    expect(constrainCamera({ x: 500, y: -99999, scale: 99 }, bounds)).toEqual({ scale: 3, x: 0, y: -11400 });
    expect(constrainCamera({ x: -500, y: -500, scale: .01 }, bounds)).toEqual({ scale: .1, x: 100, y: 0 });
  });
  it("zooms about the touched point and translates the pinch centroid", () => {
    const anchor = { x: 100, y: 200 }; const destination = { x: 140, y: 240 };
    const zoomed = zoomCamera(camera, 2, anchor, bounds, destination);
    expect((destination.x - zoomed.x) / zoomed.scale).toBe((anchor.x - camera.x) / camera.scale);
    expect((destination.y - zoomed.y) / zoomed.scale).toBe((anchor.y - camera.y) / camera.scale);
  });
  it("uses the clamped scale for the anchor calculation", () => {
    expect(zoomCamera(camera, 10, { x: 100, y: 200 }, bounds)).toEqual({ scale: 3, x: -1400, y: -2800 });
  });
  it("keeps a tap selectable, suppresses dragging and cancellation clicks", () => {
    const gesture = new CameraGesture(); gesture.down(1, { x: 20, y: 20 }, camera);
    expect(gesture.move(1, { x: 23, y: 23 }, camera, bounds)).toBe(camera);
    gesture.up(1, camera); expect(gesture.suppressClick).toBe(false);
    gesture.down(1, { x: 20, y: 20 }, camera);
    const moved = gesture.move(1, { x: 60, y: 90 }, camera, bounds);
    expect(moved).toEqual({ ...camera, x: -360, y: -730 });
    gesture.up(1, moved); expect(gesture.suppressClick).toBe(true);
    gesture.down(2, { x: 10, y: 10 }, moved); expect(gesture.suppressClick).toBe(false);
    gesture.up(2, moved, true); expect(gesture.suppressClick).toBe(true);
  });
  it("rebases from pan to pinch to pan without jumps or accidental selection", () => {
    const gesture = new CameraGesture(); gesture.down(1, { x: 100, y: 100 }, camera);
    gesture.down(2, { x: 200, y: 100 }, camera);
    const zoomed = gesture.move(2, { x: 300, y: 100 }, camera, bounds);
    expect(zoomed).toEqual({ scale: 2, x: -900, y: -1700 });
    gesture.up(2, zoomed);
    expect(gesture.move(1, { x: 100, y: 100 }, zoomed, bounds)).toEqual(zoomed);
    const panned = gesture.move(1, { x: 120, y: 140 }, zoomed, bounds);
    expect(panned).toEqual({ ...zoomed, x: -880, y: -1660 });
    gesture.up(1, panned); expect(gesture.suppressClick).toBe(true);
    expect(gesture.move(88, { x: 0, y: 0 }, panned, bounds)).toBe(panned);
  });
  it("handles coincident pointers without invalid transforms", () => {
    const gesture = new CameraGesture(); gesture.down(1, { x: 0, y: 0 }, camera); gesture.down(2, { x: 0, y: 0 }, camera);
    expect(gesture.move(2, { x: 0, y: 0 }, camera, bounds)).toBe(camera);
    gesture.clear(); expect(gesture.suppressClick).toBe(false);
  });
  it("reveals search results within the camera without changing layout", () => {
    const result = revealInCamera(camera, { x: 1200, y: 2000, width: 100, height: 80 }, bounds);
    expect(result).toEqual({ scale: 1, x: -1050, y: -1740 });
  });
});
