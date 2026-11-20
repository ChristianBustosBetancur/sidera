import type { VersionCourseId } from "@sidera/curriculum-domain";
export type MobileDetailState = { selectedId: VersionCourseId | null; detailOpen: boolean };
export type MobileDetailAction = { type: "select"; id: VersionCourseId | null } | { type: "open" } | { type: "close" };
export const initialMobileDetail: MobileDetailState = { selectedId: null, detailOpen: false };
export function mobileDetailReducer(state: MobileDetailState, action: MobileDetailAction): MobileDetailState {
  if (action.type === "select") return { selectedId: action.id, detailOpen: false };
  if (action.type === "close") return { ...state, detailOpen: false };
  return state.selectedId === null ? state : { ...state, detailOpen: true };
}
