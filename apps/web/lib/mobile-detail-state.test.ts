import { describe, expect, it } from "vitest";
import type { VersionCourseId } from "@sidera/curriculum-domain";
import { initialMobileDetail, mobileDetailReducer } from "./mobile-detail-state";
const first = "first" as VersionCourseId;
const second = "second" as VersionCourseId;
describe("on-demand course details", () => {
  it("selects without automatically opening a panel", () => {
    expect(mobileDetailReducer(initialMobileDetail, { type: "select", id: first })).toEqual({ selectedId: first, detailOpen: false });
  });
  it("opens explicitly and closes without clearing selection", () => {
    const selected = mobileDetailReducer(initialMobileDetail, { type: "select", id: first });
    const opened = mobileDetailReducer(selected, { type: "open" });
    expect(opened).toEqual({ selectedId: first, detailOpen: true });
    expect(mobileDetailReducer(opened, { type: "close" })).toEqual(selected);
    expect(mobileDetailReducer(initialMobileDetail, { type: "open" })).toBe(initialMobileDetail);
  });
  it("new selection closes old detail; clearing focus clears detail", () => {
    expect(mobileDetailReducer({ selectedId: first, detailOpen: true }, { type: "select", id: second })).toEqual({ selectedId: second, detailOpen: false });
    expect(mobileDetailReducer({ selectedId: first, detailOpen: true }, { type: "select", id: null })).toEqual(initialMobileDetail);
  });
});
