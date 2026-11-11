import { act, renderHook } from "@testing-library/react";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { useTableLayout } from "../use-table-layout";

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

describe("useTableLayout", () => {
  it("merges patches, keeps other fields, and forgets a table back at its defaults", () => {
    const { result } = renderHook(() => useTableLayout("collection:genome"));
    act(() => {
      result.current[1]({ visibility: { a: false } });
    });
    act(() => {
      result.current[1]({ widths: { a: 120 } });
    });
    expect(result.current[0]).toStrictEqual({
      visibility: { a: false },
      widths: { a: 120 },
    });

    act(() => {
      result.current[1]({ visibility: undefined, widths: undefined });
    });
    expect(
      localStorage.getItem("dxkb-table-layout:v1:collection:genome"),
    ).toBeNull();
  });

  it("writes back a field this build does not know, without rendering it", () => {
    const key = "dxkb-table-layout:v1:collection:genome";
    localStorage.setItem(key, '{"density":"compact","order":["b","a"]}');
    const { result } = renderHook(() => useTableLayout("collection:genome"));
    expect(result.current[0]).toStrictEqual({ order: ["b", "a"] });

    act(() => {
      result.current[1]({ widths: { a: 120 } });
    });
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toStrictEqual({
      density: "compact",
      order: ["b", "a"],
      widths: { a: 120 },
    });
    expect(result.current[0]).toStrictEqual({
      order: ["b", "a"],
      widths: { a: 120 },
    });
  });

  it("resolves a function patch against the layout stored at write time", () => {
    const key = "dxkb-table-layout:v1:workspace";
    const { result } = renderHook(() => useTableLayout("workspace"));
    localStorage.setItem(key, JSON.stringify({ widths: { ownerId: 90 } }));
    act(() => {
      result.current[1]((current) => ({
        widths: { ...current.widths, name: 300 },
      }));
    });
    expect(JSON.parse(localStorage.getItem(key) ?? "{}")).toStrictEqual({
      widths: { ownerId: 90, name: 300 },
    });
  });

  it("keeps tables apart", () => {
    const { result } = renderHook(() => ({
      genome: useTableLayout("collection:genome"),
      feature: useTableLayout("collection:genome_feature"),
    }));
    act(() => {
      result.current.genome[1]({ order: ["b", "a"] });
    });
    expect(result.current.feature[0]).toStrictEqual({});
  });
});
