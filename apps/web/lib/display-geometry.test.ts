import { describe, expect, it } from "vitest";
import { canvasPoint, planOverviewScale } from "./display-geometry";

describe("overview geometry", () => {
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
