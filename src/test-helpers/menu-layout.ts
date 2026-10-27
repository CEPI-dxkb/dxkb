/**
 * jsdom has no layout engine. The collection toolbar's menus scroll rows into
 * view (checking `matchMedia` for reduced motion) and its pill row measures
 * itself through a ResizeObserver, so stub those and give every element a
 * `clientWidth`, which the pill row reads as its free space (jsdom reports 0,
 * which would put every pill behind "+N").
 * Call once per file; `setClientWidth` changes the width for one test.
 */
export function stubMenuLayout(initialWidth = 1000) {
  let width = initialWidth;
  const patched = [
    [Element.prototype, "scrollIntoView", { value: () => undefined }],
    [Element.prototype, "scrollTo", { value: () => undefined }],
    [HTMLElement.prototype, "clientWidth", { get: () => width }],
    [
      window,
      "matchMedia",
      {
        value: (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          }) as unknown as MediaQueryList,
      },
    ],
  ] as const;
  const originals = patched.map(([target, key]) =>
    Object.getOwnPropertyDescriptor(target, key),
  );
  const originalResizeObserver = globalThis.ResizeObserver as
    | typeof ResizeObserver
    | undefined;

  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    };
    for (const [target, key, descriptor] of patched) {
      Object.defineProperty(target, key, {
        configurable: true,
        ...descriptor,
      });
    }
  });
  beforeEach(() => {
    width = initialWidth;
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

  return {
    setClientWidth: (next: number) => {
      width = next;
    },
  };
}
