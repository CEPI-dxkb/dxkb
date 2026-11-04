import type React from "react";

/**
 * Follows the pointer that pressed `event.currentTarget` until it is
 * released. The pointer is captured, so its moves keep arriving outside the
 * element and other pointers (a second finger) are ignored. The listeners
 * live on the element, not the document, so a table unmounted mid-drag drops
 * them without ending, or committing, the drag.
 *
 * Returns false, doing nothing, for a press that is not a drag (a mouse
 * button other than the primary one, or a non-primary pointer such as a
 * second finger, which must not start a concurrent drag).
 */
export function followPointer(
  event: React.PointerEvent<HTMLElement>,
  handlers: {
    onMove: (clientX: number) => void;
    /** `released`: the pointer was lifted (true) or cancelled (false). */
    onEnd: (released: boolean) => void;
  },
): boolean {
  if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0))
    return false;
  // Cancelling pointerdown suppresses the compatibility mouse events, and with
  // them the native drag and text selection those start (the handles' select-none
  // covers selection). The header underneath does not see the press.
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
  // After pointerup this finds the listeners already removed.
  element.addEventListener("lostpointercapture", onCancel);
  return true;
}
