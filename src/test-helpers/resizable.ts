import { act, fireEvent } from "@testing-library/react";

/** jsdom has no layout: stub ResizeObserver and element sizes so the real panel arithmetic runs; a group is 2 × `size`, so pick one no minSize/maxSize clamps. */
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

/** The inline flex-grow per panel in DOM order; pass `root` for markup that is not mounted. */
export function panelShares(root: ParentNode = document) {
  return [...root.querySelectorAll("[data-panel]")].map(
    (panel) => (panel as HTMLElement).style.flexGrow,
  );
}

export function pressOnSeparator(key: string, index = 0) {
  const separator = document.querySelectorAll("[data-slot='resizable-handle']")[
    index
  ] as HTMLElement;
  act(() => {
    fireEvent.keyDown(separator, { key });
  });
}
