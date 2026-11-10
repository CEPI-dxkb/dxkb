/** jsdom's localStorage, restored after `vi.unstubAllGlobals()` (see vitest.setup.ts). */
export function jsdomLocalStorage(): Storage {
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (!dom) throw new Error("jsdomLocalStorage needs the jsdom environment");
  return dom.window.localStorage;
}
