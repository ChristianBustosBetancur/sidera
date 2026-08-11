import { describe, expect, it } from "vitest";
import {
  hasExceededDragThreshold,
  shouldSuppressClick,
} from "./pointer-gestures";

describe("pointer gesture decisions", () => {
  it("does not mark movement at the drag threshold", () => {
    expect(hasExceededDragThreshold(3, 4, 5)).toBe(false);
  });

  it("marks movement above the drag threshold", () => {
    expect(hasExceededDragThreshold(4, 4, 5)).toBe(true);
  });

  it("suppresses a requested click after movement", () => {
    expect(shouldSuppressClick(true, true)).toBe(true);
  });

  it("does not suppress a click without movement", () => {
    expect(shouldSuppressClick(false, true)).toBe(false);
  });
});
