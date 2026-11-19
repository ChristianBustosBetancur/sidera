import { describe, expect, it } from "vitest";
import type { VersionCourseId } from "@sidera/curriculum-domain";
import { initialMobileDetail, mobileDetailReducer } from "./mobile-detail-state";

const first = "first" as VersionCourseId;
const second = "second" as VersionCourseId;

describe("mobile course detail", () => {
  it("opens compact for each selection, including reopening a course", () => {
    const expanded = mobileDetailReducer({ selectedId: first, expanded: true }, { type: "select", id: second });
    expect(expanded).toEqual({ selectedId: second, expanded: false });
    expect(mobileDetailReducer({ selectedId: first, expanded: true }, { type: "select", id: first }).expanded).toBe(false);
  });
  it("expands and collapses without losing selection", () => {
    const selected = mobileDetailReducer(initialMobileDetail, { type: "select", id: first });
    const expanded = mobileDetailReducer(selected, { type: "toggle" });
    expect(expanded).toEqual({ selectedId: first, expanded: true });
    expect(mobileDetailReducer(expanded, { type: "toggle" })).toEqual(selected);
  });
  it("closing clears selection and expansion; toggling a closed panel is inert", () => {
    expect(mobileDetailReducer({ selectedId: first, expanded: true }, { type: "select", id: null })).toEqual(initialMobileDetail);
    expect(mobileDetailReducer(initialMobileDetail, { type: "toggle" })).toBe(initialMobileDetail);
  });
});
