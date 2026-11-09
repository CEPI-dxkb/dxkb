/**
 * jsdom's working localStorage. Node 25+ defines a Web Storage global of
 * its own (undefined without --localstorage-file), which is what a suite gets back
 * after `vi.unstubAllGlobals()` until the next test's setup re-stub (see the
 * matching note in vitest.setup.ts).
 */
export function jsdomLocalStorage(): Storage {
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (!dom) throw new Error("jsdomLocalStorage needs the jsdom environment");
  return dom.window.localStorage;
}
