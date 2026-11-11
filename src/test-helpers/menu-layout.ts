/** jsdom has no layout: stub `matchMedia`, ResizeObserver and `clientWidth` (0 would hide every pill behind "+N"). */
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
