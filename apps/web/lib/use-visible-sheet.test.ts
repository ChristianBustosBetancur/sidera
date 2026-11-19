import { describe, expect, it } from "vitest";
import { sheetBounds } from "./use-visible-sheet";

describe("sheet composition within the visible viewport", () => {
  it("follows a narrowed, panned viewport without changing its CSS pixel scale", () => {
    const bounds = sheetBounds(844, { offsetLeft: 140, offsetTop: 200, width: 195, height: 422 });
    expect(bounds.left).toBe(140);
    expect(bounds.width).toBe(195);
    expect(844 - bounds.bottom).toBe(622);
    expect(bounds.height).toBe(422);
  });
  it("keeps controls above the keyboard and handles elastic overscroll", () => {
    const keyboard = sheetBounds(844, { offsetLeft: 0, offsetTop: 0, width: 390, height: 400 });
    expect(keyboard.bottom).toBe(444);
    const overscroll = sheetBounds(844, { offsetLeft: -3, offsetTop: 10, width: 390, height: 844 });
    expect(overscroll.left).toBe(0);
    expect(overscroll.bottom).toBe(0);
  });
});
