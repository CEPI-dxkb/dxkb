import { act, renderHook } from "@testing-library/react";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { useUiPreference } from "../provider";

describe("useUiPreference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts from the server-provided preferences", () => {
    const { result } = renderHook(() => useUiPreference("viewNavCollapsed"), {
      wrapper: createUiPreferencesWrapper({ viewNavCollapsed: true }),
    });
    expect(result.current[0]).toBe(true);
  });

  it("updates every consumer and writes only the changed cookie", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    const { result } = renderHook(
      () => ({
        first: useUiPreference("viewNavCollapsed"),
        second: useUiPreference("viewNavCollapsed"),
      }),
      { wrapper: createUiPreferencesWrapper() },
    );
    cookieSpy.mockClear(); // drop the one-time legacy-cookie expiry from mount

    act(() => {
      result.current.first[1]((current) => !current);
    });

    expect(result.current.second[0]).toBe(true);
    expect(cookieSpy).toHaveBeenCalledTimes(1);
    expect(cookieSpy).toHaveBeenCalledWith(
      "dxkb-view-nav-collapsed=true; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("does not write a cookie when the value is unchanged", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    const { result } = renderHook(() => useUiPreference("viewNavCollapsed"), {
      wrapper: createUiPreferencesWrapper(),
    });
    cookieSpy.mockClear();

    act(() => {
      result.current[1](false);
    });

    expect(cookieSpy).not.toHaveBeenCalled();
  });

  it("expires the legacy workspace cookie once on mount", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    const { result, rerender } = renderHook(
      () => useUiPreference("viewNavCollapsed"),
      { wrapper: createUiPreferencesWrapper() },
    );
    // Neither a re-render nor a preference update may expire it again.
    rerender();
    act(() => {
      result.current[1](true);
    });

    // Count only the legacy expiry; the update above writes its own cookie.
    const legacyWrites = cookieSpy.mock.calls.filter(([value]) =>
      value.startsWith("workspace-panel-layout="),
    );
    expect(legacyWrites).toStrictEqual([
      ["workspace-panel-layout=; Path=/workspace; Max-Age=0; SameSite=Lax"],
    ]);
  });

  it("behaves like plain component state without a provider", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    const { result } = renderHook(() => useUiPreference("viewNavCollapsed"));
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(cookieSpy).not.toHaveBeenCalled();
  });
});
