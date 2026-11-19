/** `next/navigation` mock for History-API URL state, which jsdom does not keep in step with `useSearchParams` (pushes, replaces and Back/Forward re-render subscribers); call inside the `vi.mock` factory and reset the address in `beforeEach`. */
export async function historyNavigationMock({
  pathname = "/",
}: { pathname?: string } = {}) {
  const { useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      original(data, unused, url);
      listeners.forEach((listener) => {
        listener();
      });
    };
  }
  // Back/Forward changes the address too, and Next re-renders on it.
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.addEventListener("popstate", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("popstate", listener);
    };
  };
  return {
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => pathname,
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => "",
        ),
      ),
  };
}
