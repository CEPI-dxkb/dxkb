import { act, renderHook } from "@testing-library/react";
import { useViewportSize } from "@/hooks/use-viewport-size";

describe("useViewportSize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the window size", () => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);

    const { result } = renderHook(() => useViewportSize());

    expect(result.current).toEqual({ width: 1440, height: 900 });
  });

  it("follows the window when it is resized", () => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      vi.stubGlobal("innerWidth", 1024);
      vi.stubGlobal("innerHeight", 700);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toEqual({ width: 1024, height: 700 });
  });
});
