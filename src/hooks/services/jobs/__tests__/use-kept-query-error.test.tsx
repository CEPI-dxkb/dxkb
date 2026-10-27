import { renderHook } from "@testing-library/react";
import { useKeptQueryError } from "../use-kept-query-error";

interface Props {
  error: unknown;
  hasData: boolean;
  identity: string;
}

function renderKept(initialProps: Props) {
  return renderHook(
    ({ error, hasData, identity }: Props) =>
      useKeptQueryError({ error, hasData }, identity),
    { initialProps },
  );
}

describe("useKeptQueryError", () => {
  const outage = new Error("The BV-BRC job service did not respond.");

  it("keeps a query's error while a refetch has put it back to pending", () => {
    const { result, rerender } = renderKept({
      error: outage,
      hasData: false,
      identity: "page-2",
    });
    expect(result.current).toBe(outage);

    // TanStack clears the error of a query with no data when it refetches.
    rerender({ error: null, hasData: false, identity: "page-2" });
    expect(result.current).toBe(outage);
  });

  it("shows a newer error in place of the kept one", () => {
    const { result, rerender } = renderKept({
      error: outage,
      hasData: false,
      identity: "page-2",
    });
    const later = new Error("The BV-BRC job service is unavailable (503).");
    rerender({ error: null, hasData: false, identity: "page-2" });
    rerender({ error: later, hasData: false, identity: "page-2" });
    rerender({ error: null, hasData: false, identity: "page-2" });

    expect(result.current).toBe(later);
  });

  it("drops the kept error once the query has data", () => {
    const { result, rerender } = renderKept({
      error: outage,
      hasData: false,
      identity: "page-2",
    });
    rerender({ error: null, hasData: true, identity: "page-2" });
    expect(result.current).toBeNull();

    rerender({ error: null, hasData: false, identity: "page-2" });
    expect(result.current).toBeNull();
  });

  it("keeps each query's error to itself, and brings it back on return", () => {
    const { result, rerender } = renderKept({
      error: outage,
      hasData: false,
      identity: "page-2",
    });

    rerender({ error: null, hasData: false, identity: "page-3" });
    expect(result.current).toBeNull();

    rerender({ error: null, hasData: false, identity: "page-2" });
    expect(result.current).toBe(outage);
  });

  it("returns the query's own error when it has data", () => {
    const { result } = renderKept({
      error: outage,
      hasData: true,
      identity: "page-1",
    });
    expect(result.current).toBe(outage);
  });
});
