import { fireEvent } from "@testing-library/react";
import type React from "react";
import { followPointer } from "../pointer-drag";

// jsdom has no pointer capture.
const setPointerCapture = vi.fn();
Element.prototype.setPointerCapture = setPointerCapture;
Element.prototype.releasePointerCapture = vi.fn();

const preventDefault = vi.fn();
const stopPropagation = vi.fn();

function press(element: HTMLElement, init: Partial<PointerEventInit> = {}) {
  const native = new PointerEvent("pointerdown", {
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
    isPrimary: true,
    clientX: 100,
    ...init,
  });
  return {
    nativeEvent: native,
    currentTarget: element,
    pointerId: native.pointerId,
    pointerType: native.pointerType,
    isPrimary: native.isPrimary,
    button: native.button,
    clientX: native.clientX,
    preventDefault,
    stopPropagation,
  } as unknown as React.PointerEvent<HTMLElement>;
}

describe("followPointer", () => {
  beforeEach(() => {
    setPointerCapture.mockClear();
    preventDefault.mockClear();
    stopPropagation.mockClear();
  });

  it("follows its pointer until release", () => {
    const handle = document.createElement("div");
    const onMove = vi.fn();
    const onEnd = vi.fn();
    expect(followPointer(press(handle), { onMove, onEnd })).toBe(true);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 130 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 999 });
    fireEvent.pointerUp(handle, { pointerId: 2 });
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onMove.mock.calls).toEqual([[130]]);
    expect(onEnd).toHaveBeenCalledWith(true);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("ends without committing when the pointer is cancelled", () => {
    const handle = document.createElement("div");
    const onMove = vi.fn();
    const onEnd = vi.fn();
    followPointer(press(handle, { pointerType: "touch" }), { onMove, onEnd });
    fireEvent.pointerCancel(handle, { pointerId: 2 });
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(onEnd).toHaveBeenCalledWith(false);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("ends without committing when capture is lost", () => {
    const handle = document.createElement("div");
    const onEnd = vi.fn();
    followPointer(press(handle), { onMove: vi.fn(), onEnd });
    handle.dispatchEvent(
      new PointerEvent("lostpointercapture", { pointerId: 1 }),
    );
    expect(onEnd).toHaveBeenCalledWith(false);
  });

  it("ignores a secondary mouse button", () => {
    const handle = document.createElement("div");
    const event = press(handle, { button: 2 });
    expect(followPointer(event, { onMove: vi.fn(), onEnd: vi.fn() })).toBe(
      false,
    );
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("ignores a non-primary pointer", () => {
    const handle = document.createElement("div");
    const event = press(handle, { isPrimary: false, pointerType: "touch" });
    expect(followPointer(event, { onMove: vi.fn(), onEnd: vi.fn() })).toBe(
      false,
    );
    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});
