/**
 * jsdom's working localStorage. Node 22+ defines a broken experimental global of
 * its own, which is what a suite gets back after `vi.unstubAllGlobals()` (see the
 * matching note in vitest.setup.ts).
 */
export function jsdomLocalStorage(): Storage {
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (!dom) throw new Error("jsdomLocalStorage needs the jsdom environment");
  return dom.window.localStorage;
}
