/**
 * `next/navigation` for a component whose URL state is written with the History API.
 * Next keeps `useSearchParams` in step with `pushState`/`replaceState`; jsdom does
 * not, so this wraps both (once per suite, when the mock is first loaded) and
 * re-renders the subscribers whenever either runs. Reset the address with
 * `history.replaceState` in `beforeEach`: the URL outlives a test.
 *
 * Call it from inside the `vi.mock` factory, like the other mock builders:
 * `vi.mock("next/navigation", async () => (await import("@/test-helpers/history-navigation")).historyNavigationMock())`.
 */
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
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
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
