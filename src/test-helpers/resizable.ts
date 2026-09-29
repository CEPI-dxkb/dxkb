import { act, fireEvent } from "@testing-library/react";

/**
 * jsdom has no layout engine. Stub ResizeObserver and give every element a non-zero
 * size so the real react-resizable-panels layout arithmetic runs. Call once per file.
 *
 * The library sizes a group as the sum of its panels' stubbed sizes, so a two-panel
 * group is 2 × `size`. Pick `size` so no panel's minSize/maxSize clamps the split
 * you assert.
 */
export function stubResizableGeometry(size = 500) {
  const original = {
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
    height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
  };
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    };
    for (const property of ["offsetWidth", "offsetHeight"] as const) {
      Object.defineProperty(HTMLElement.prototype, property, {
        configurable: true,
        value: size,
      });
    }
  });
  afterAll(() => {
    if (original.width)
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", original.width);
    if (original.height)
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", original.height);
  });
}

/**
 * The split the group actually rendered: inline flex-grow per panel, in DOM order.
 * Pass `root` to read markup that is not mounted, such as `renderToString` output.
 */
export function panelShares(root: ParentNode = document) {
  return [...root.querySelectorAll("[data-panel]")].map(
    (panel) => (panel as HTMLElement).style.flexGrow,
  );
}

/** A real, user-attributed resize through the separator's own keyboard handler (5% per step). */
export function pressOnSeparator(key: string, index = 0) {
  const separator = document.querySelectorAll("[data-slot='resizable-handle']")[
    index
  ] as HTMLElement;
  act(() => {
    fireEvent.keyDown(separator, { key });
  });
}
