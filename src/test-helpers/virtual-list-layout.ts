import { fireEvent } from "@testing-library/react";

/**
 * jsdom has no layout, which a TanStack Virtual list reads three ways: `clientHeight` (0 draws no
 * rows), `scrollHeight` (0 caps every scroll at the top) and `Element#scrollTo` (absent). This gives
 * a scroll element a viewport of `viewportHeight` pixels, a content height read from the
 * `--list-height` custom property of its `[role="listbox"]` child (the Graph's protein list sizes
 * itself that way), and a `scrollTo` that moves the position and fires `scroll`, as a browser does.
 * Call it at the top level of a test file; it installs and restores itself around the file's tests.
 */
export function stubVirtualListLayout(viewportHeight = 320) {
  const scrollTo = vi.fn(function scrollTo(
    this: Element,
    options: ScrollToOptions,
  ) {
    this.scrollTop = options.top ?? 0;
    fireEvent.scroll(this);
  });
  const patched = [
    [Element.prototype, "clientHeight", { get: () => viewportHeight }],
    [
      Element.prototype,
      "scrollHeight",
      {
        get(this: Element) {
          const list = this.querySelector<HTMLElement>('[role="listbox"]');
          return Number.parseFloat(
            list?.style.getPropertyValue("--list-height") ?? "0",
          );
        },
      },
    ],
    [Element.prototype, "scrollTo", { value: scrollTo }],
  ] as const;
  const originals = patched.map(([target, key]) =>
    Object.getOwnPropertyDescriptor(target, key),
  );
  const originalResizeObserver = globalThis.ResizeObserver as
    | typeof ResizeObserver
    | undefined;

  beforeAll(() => {
    for (const [target, key, descriptor] of patched) {
      Object.defineProperty(target, key, {
        configurable: true,
        ...descriptor,
      });
    }
    globalThis.ResizeObserver = class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    };
  });
  beforeEach(() => {
    scrollTo.mockClear();
  });
  afterAll(() => {
    if (originalResizeObserver) globalThis.ResizeObserver = originalResizeObserver;
    else Reflect.deleteProperty(globalThis, "ResizeObserver");
    patched.forEach(([target, key], index) => {
      const original = originals[index];
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    });
  });

  return { scrollTo };
}
