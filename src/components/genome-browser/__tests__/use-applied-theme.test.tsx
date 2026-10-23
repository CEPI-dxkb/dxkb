import { act, renderHook } from "@testing-library/react";
import { useAppliedTheme } from "../use-applied-theme";

function setTheme(value: string | null) {
  if (value === null) document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", value);
}

/** Lets the MutationObserver's microtask deliver before act() returns. */
function settled(): Promise<void> {
  return Promise.resolve();
}

describe("useAppliedTheme", () => {
  afterEach(() => {
    setTheme(null);
  });

  it("reads the theme on <html>", () => {
    setTheme("bvbrc-dark");
    const { result } = renderHook(() => useAppliedTheme());
    expect(result.current).toBe("bvbrc-dark");
  });

  it("is undefined while no theme is applied", () => {
    const { result } = renderHook(() => useAppliedTheme());
    expect(result.current).toBeUndefined();
  });

  it("re-renders once the new theme is on <html>, not before", async () => {
    setTheme("dxkb-light");
    const seen: (string | undefined)[] = [];
    const { result } = renderHook(() => {
      const theme = useAppliedTheme();
      seen.push(theme);
      return theme;
    });
    await act(() => {
      setTheme("dxkb-dark");
      return settled();
    });
    expect(result.current).toBe("dxkb-dark");
    expect(seen).toEqual(["dxkb-light", "dxkb-dark"]);
  });

  it("follows the theme being removed", async () => {
    setTheme("violet-light");
    const { result } = renderHook(() => useAppliedTheme());
    await act(() => {
      setTheme(null);
      return settled();
    });
    expect(result.current).toBeUndefined();
  });

  it("ignores other attributes of <html>", async () => {
    setTheme("dxkb-light");
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useAppliedTheme();
    });
    const before = renders;
    await act(() => {
      document.documentElement.setAttribute("lang", "en");
      document.documentElement.setAttribute("data-other", "x");
      return settled();
    });
    document.documentElement.removeAttribute("data-other");
    expect(renders).toBe(before);
  });

  it("stops observing on unmount", () => {
    setTheme("dxkb-light");
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { unmount } = renderHook(() => useAppliedTheme());
    unmount();
    expect(disconnect).toHaveBeenCalled();
    disconnect.mockRestore();
  });
});
