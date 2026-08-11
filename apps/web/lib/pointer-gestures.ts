export function hasExceededDragThreshold(
  deltaX: number,
  deltaY: number,
  threshold: number,
): boolean {
  return Math.hypot(deltaX, deltaY) > threshold;
}

export function shouldSuppressClick(
  moved: boolean,
  suppressClick: boolean,
): boolean {
  return moved && suppressClick;
}
