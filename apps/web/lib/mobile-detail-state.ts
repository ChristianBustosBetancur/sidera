import type { VersionCourseId } from "@sidera/curriculum-domain";

export type MobileDetailState = { selectedId: VersionCourseId | null; expanded: boolean };
export type MobileDetailAction =
  | { type: "select"; id: VersionCourseId | null }
  | { type: "toggle" };

export const initialMobileDetail: MobileDetailState = { selectedId: null, expanded: false };

export function mobileDetailReducer(state: MobileDetailState, action: MobileDetailAction): MobileDetailState {
  if (action.type === "select") return { selectedId: action.id, expanded: false };
  if (state.selectedId === null) return state;
  return { ...state, expanded: !state.expanded };
}
