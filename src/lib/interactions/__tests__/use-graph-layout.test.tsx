import { act, renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";

import { createQueryClientWrapper } from "@/test-helpers/react";

import { requestGraphLayout } from "../layout-client";
import { useGraphLayout } from "../use-graph-layout";
import type { GEdge, GNode, LayoutName } from "../types";

vi.mock("../layout-client", () => ({
  requestGraphLayout: vi.fn(),
}));

const nodes: GNode[] = [
  { id: "a", kind: "microbial" },
  { id: "b", kind: "host" },
];
const edges: GEdge[] = [
  {
    id: "a-b",
    source: "a",
    target: "b",
    evidence: "",
    interactionType: "",
    detectionMethod: "",
    experimental: false,
  },
];

interface Props {
  layout: LayoutName;
  data: object;
}

// Stand-ins for two distinct `useInteractions` results.
const rowsA = { rows: ["a"] };
const rowsB = { rows: ["b"] };

function useLayout({ layout, data }: Props) {
  return useGraphLayout({
    rql: "eq(evidence,experimental)",
    keywordValue: "",
    data,
    nodes,
    edges,
    layout,
  });
}

/** A computation the test settles by hand. */
function deferredLayout() {
  let resolve: (positions: Float64Array) => void = () => undefined;
  const promise = new Promise<Float64Array>((settle) => {
    resolve = settle;
  });
  vi.mocked(requestGraphLayout).mockReturnValueOnce(promise);
  return resolve;
}

beforeEach(() => {
  vi.mocked(requestGraphLayout).mockImplementation((request) =>
    Promise.resolve(new Float64Array(2 * request.nodeCount).fill(7)),
  );
});

describe("useGraphLayout", () => {
  it("asks for the current layout over the indexed graph", async () => {
    const { result } = renderHook(useLayout, {
      wrapper: createQueryClientWrapper(),
      initialProps: { layout: "grid", data: rowsA },
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(4);
    });
    expect(requestGraphLayout).toHaveBeenCalledTimes(1);
    const [request, options] = vi.mocked(requestGraphLayout).mock.calls[0];
    expect(request.nodeCount).toBe(2);
    expect(request.layout).toBe("grid");
    expect(Array.from(request.edges)).toEqual([0, 1]);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reuses the positions after an unmount and remount with the same inputs", async () => {
    const wrapper = createQueryClientWrapper();
    const first = renderHook(useLayout, {
      wrapper,
      initialProps: { layout: "forceatlas2", data: rowsA },
    });
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true);
    });
    const positions = first.result.current.data;
    first.unmount();

    // A return to the Graph tab remounts the graph against the same cache.
    const second = renderHook(useLayout, {
      wrapper,
      initialProps: { layout: "forceatlas2", data: rowsA },
    });

    expect(second.result.current.data).toBe(positions);
    expect(second.result.current.isFetching).toBe(false);
    expect(requestGraphLayout).toHaveBeenCalledTimes(1);
  });

  it("computes a new layout once and keeps the previous positions meanwhile", async () => {
    const { result, rerender } = renderHook(useLayout, {
      wrapper: createQueryClientWrapper(),
      initialProps: { layout: "forceatlas2", data: rowsA },
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const previous = result.current.data;

    const resolve = deferredLayout();
    rerender({ layout: "circular", data: rowsA });

    expect(result.current.isFetching).toBe(true);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(previous);

    const next = new Float64Array([1, 2, 3, 4]);
    resolve(next);
    await waitFor(() => {
      expect(result.current.data).toBe(next);
    });
    expect(result.current.isFetching).toBe(false);
    expect(requestGraphLayout).toHaveBeenCalledTimes(2);
    expect(vi.mocked(requestGraphLayout).mock.calls[1][0].layout).toBe(
      "circular",
    );
  });

  it("drops the previous positions when the rows object changes", async () => {
    const { result, rerender } = renderHook(useLayout, {
      wrapper: createQueryClientWrapper(),
      initialProps: { layout: "forceatlas2", data: rowsA },
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const resolve = deferredLayout();
    rerender({ layout: "forceatlas2", data: rowsB });

    // Positions computed for other rows would not line up with these nodes.
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toBeUndefined();

    resolve(new Float64Array(4));
    await waitFor(() => {
      expect(result.current.data).toHaveLength(4);
    });
  });

  it("computes nothing for an empty graph", () => {
    const { result } = renderHook(
      () =>
        useGraphLayout({
          rql: "",
          keywordValue: "",
          data: undefined,
          nodes: [],
          edges: [],
          layout: "forceatlas2",
        }),
      { wrapper: createQueryClientWrapper() },
    );

    expect(result.current.isFetching).toBe(false);
    expect(requestGraphLayout).not.toHaveBeenCalled();
  });

  describe("across a refetch of the rows", () => {
    let serverRows: { id: string }[] = [];
    let rowFetches = 0;

    // The rows come from a real query, so TanStack's structural sharing decides
    // whether a refetch hands back the same `data` reference.
    function useRowsAndLayout() {
      const rows = useQuery({
        queryKey: ["rows"],
        queryFn: () => {
          rowFetches += 1;
          // Fresh objects every time, as a network response would be.
          return Promise.resolve({ rows: serverRows.map((row) => ({ ...row })) });
        },
      });
      const layout = useGraphLayout({
        rql: "",
        keywordValue: "",
        data: rows.data,
        nodes: rows.data ? nodes : [],
        edges,
        layout: "forceatlas2",
      });
      return { rows, layout };
    }

    async function settledHook() {
      const hook = renderHook(useRowsAndLayout, {
        wrapper: createQueryClientWrapper(),
      });
      await waitFor(() => {
        expect(hook.result.current.layout.isSuccess).toBe(true);
      });
      return hook;
    }

    beforeEach(() => {
      serverRows = [{ id: "ppi-1" }];
      rowFetches = 0;
    });

    it("keeps the positions when a refetch returns identical rows", async () => {
      const { result } = await settledHook();
      const positions = result.current.layout.data;
      const rowsBefore = result.current.rows.data;
      const updatedBefore = result.current.rows.dataUpdatedAt;
      // Past the first fetch's millisecond, so the refetch's timestamp differs.
      await new Promise((resolve) => setTimeout(resolve, 5));

      await act(() => result.current.rows.refetch());
      // The render that carries the refetched result (the old key moved here).
      await waitFor(() => {
        expect(result.current.rows.dataUpdatedAt).not.toBe(updatedBefore);
      });

      // A second fetch, but structural sharing keeps the same rows object, so
      // the same positions (and picture) stay.
      expect(rowFetches).toBe(2);
      expect(result.current.rows.data).toBe(rowsBefore);
      expect(result.current.layout.data).toBe(positions);
      expect(result.current.layout.isFetching).toBe(false);
      expect(requestGraphLayout).toHaveBeenCalledTimes(1);
    });

    it("lays out again when a refetch returns changed rows", async () => {
      const { result } = await settledHook();

      const rowsBefore = result.current.rows.data;

      serverRows = [{ id: "ppi-2" }];
      await act(() => result.current.rows.refetch());

      await waitFor(() => {
        expect(result.current.rows.data).not.toBe(rowsBefore);
        expect(requestGraphLayout).toHaveBeenCalledTimes(2);
      });
    });
  });
});
