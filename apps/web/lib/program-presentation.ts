/** Display metadata only. Never used to derive dependencies or eligibility. */
export const mathematicsGroupingOrder = [
  "mathematics", "physics", "geometry", "analysis", "algebra", "applied", "electives", "degree",
] as const;

export function orderMathematicsGroupings<T extends { id: string }>(groupings: readonly T[]): T[] {
  const order = mathematicsGroupingOrder.map(key => `unal-mathematics-2020-${key}`);
  return [...groupings].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
