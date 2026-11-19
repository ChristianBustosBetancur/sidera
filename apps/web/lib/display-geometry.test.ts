import { describe, expect, it } from "vitest";
import { canvasPoint, panoramicScale, planOverviewScale } from "./display-geometry";

describe("overview geometry", () => {
  it("fits all six intrinsic map columns at every compact viewport", () => {
    for (const width of [336, 351, 366, 406, 720]) {
      const scale = panoramicScale(width, 2016, 16, "all-columns");
      expect(2016 * scale).toBeCloseTo(width);
      const point = canvasPoint(100 + 1700 * scale, 50 + 300 * scale, 100, 50, scale);
      expect(point.x).toBeCloseTo(1700);
      expect(point.y).toBeCloseTo(300);
    }
  });
  it("opens a desktop window into the tree without squeezing the DAG", () => {
    const scale = panoramicScale(351, 3057, 16, "desktop-window");
    expect(351 / scale).toBe(1472);
    expect(3057 * scale).toBeGreaterThan(351);
    expect(panoramicScale(720, 1000, 20, "desktop-window")).toBe(0.72);
  });
  it("never enlarges a small canvas and tolerates pre-layout measurements", () => {
    expect(panoramicScale(800, 400, 16, "all-columns")).toBe(1);
    expect(panoramicScale(0, 2016, 16, "all-columns")).toBe(1);
  });
  it("maps measured endpoints back to the SVG at either presentation scale", () => {
    for (const scale of [1, 0.6]) {
      expect(canvasPoint(40 + 272 * scale, 100 + 180 * scale, 40, 100, scale)).toEqual({ x: 272, y: 180 });
    }
  });
  it("keeps the virtual plan inside every requested compact viewport", () => {
    for (const width of [360, 375, 390, 430, 768, 1024]) {
      for (const font of [16, 20]) {
        expect(64 * font * planOverviewScale(width, font)).toBeLessThanOrEqual(width - font);
      }
    }
  });
  it("never enlarges desktop content and handles an unmeasured canvas", () => {
    expect(planOverviewScale(1440, 16)).toBe(1);
    expect(canvasPoint(30, 40, 10, 10, 0)).toEqual({ x: 20, y: 30 });
  });
});
