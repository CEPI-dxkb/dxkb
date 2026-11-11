import type React from "react";

/**
 * Follows the pointer that pressed `event.currentTarget` until it is released,
 * capturing it so moves keep arriving outside the element.
 * Listeners live on the element so a table unmounted mid-drag drops them
 * without committing the drag.
 */
export function followPointer(
  event: React.PointerEvent<HTMLElement>,
  handlers: {
    onMove: (clientX: number) => void;
    onEnd: (released: boolean) => void;
  },
): boolean {
  if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0))
    return false;
  // Cancelling pointerdown suppresses the compatibility mouse events and the
  // native drag and text selection they start.
  event.preventDefault();
  event.stopPropagation();
  const element = event.currentTarget;
  const { pointerId } = event;
  element.setPointerCapture(pointerId);

  const onMove = (move: PointerEvent) => {
    if (move.pointerId === pointerId) handlers.onMove(move.clientX);
  };
  const finish = (released: boolean) => (end: PointerEvent) => {
    if (end.pointerId !== pointerId) return;
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onCancel);
    element.removeEventListener("lostpointercapture", onCancel);
    handlers.onEnd(released);
  };
  const onUp = finish(true);
  const onCancel = finish(false);
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onCancel);
  element.addEventListener("lostpointercapture", onCancel);
  return true;
}
