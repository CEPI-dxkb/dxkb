import { act, renderHook } from "@testing-library/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { useViewNavCollapsed } from "../use-view-nav-collapsed";

vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: vi.fn() }));

describe("useViewNavCollapsed", () => {
  it("starts from the remembered preference", () => {
    const { result } = renderHook(() => useViewNavCollapsed(), {
      wrapper: createUiPreferencesWrapper({ viewNavCollapsed: true }),
    });
    expect(result.current.collapsed).toBe(true);
  });

  it("toggles from the button and from Mod+B", () => {
    const { result } = renderHook(() => useViewNavCollapsed(), {
      wrapper: createUiPreferencesWrapper(),
    });

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(true);

    const hotkeyCall = vi.mocked(useHotkey).mock.calls.at(-1);
    expect(hotkeyCall?.[0]).toBe("Mod+B");
    act(() => {
      (hotkeyCall?.[1] as () => void)();
    });
    expect(result.current.collapsed).toBe(false);
  });
});
