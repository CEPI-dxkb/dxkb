import { renderHook, act } from "@testing-library/react";
import { useRerunForm } from "@/hooks/services/use-rerun-form";

describe("useRerunForm", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
    sessionStorage.clear();
  });

  it("returns null when no rerun_key in URL", () => {
    const { result } = renderHook(() => useRerunForm());

    expect(result.current.rerunData).toBeNull();
  });

  it("returns parsed data when rerun_key exists in sessionStorage", () => {
    const data = { genome: "ATCG", recipe: "assembly" };
    sessionStorage.setItem("job-123", JSON.stringify(data));
    Object.defineProperty(window, "location", {
      value: { search: "?rerun_key=job-123" },
      writable: true,
    });

    const { result } = renderHook(() => useRerunForm());

    expect(result.current.rerunData).toEqual(data);
  });

  it("removes key from sessionStorage after reading", () => {
    sessionStorage.setItem("job-456", JSON.stringify({ foo: "bar" }));
    Object.defineProperty(window, "location", {
      value: { search: "?rerun_key=job-456" },
      writable: true,
    });

    renderHook(() => useRerunForm());

    expect(sessionStorage.getItem("job-456")).toBeNull();
  });

  it("markApplied returns true first time, false second time", () => {
    sessionStorage.setItem("job-789", JSON.stringify({ x: 1 }));
    Object.defineProperty(window, "location", {
      value: { search: "?rerun_key=job-789" },
      writable: true,
    });

    const { result } = renderHook(() => useRerunForm());

    const results: boolean[] = [];
    act(() => {
      results.push(result.current.markApplied());
      results.push(result.current.markApplied());
    });

    expect(results[0]).toBe(true);
    expect(results[1]).toBe(false);
  });

  it("returns null when sessionStorage has invalid JSON", () => {
    sessionStorage.setItem("bad-key", "not-valid-json{{{");
    Object.defineProperty(window, "location", {
      value: { search: "?rerun_key=bad-key" },
      writable: true,
    });

    const { result } = renderHook(() => useRerunForm());

    expect(result.current.rerunData).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "[useRerunForm] Failed to parse rerun data from sessionStorage",
    );
  });
});
