import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { customTrack, defaultTracks, type CircularTrack } from "@/lib/circular-viewer/tracks";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import {
  useCircularTrackData,
  useRetriesKeepingErrors,
  type RetryableQuery,
} from "../use-circular-track-data";

describe("useRetriesKeepingErrors", () => {
  const down = new Error("The BV-BRC data service is unavailable (HTTP 503).");

  function setup(initial: readonly RetryableQuery[]) {
    return renderHook((queries: readonly RetryableQuery[]) => useRetriesKeepingErrors(queries), {
      initialProps: initial,
    });
  }

  it("lists only the failed queries, each with its own retry", () => {
    const refetchA = vi.fn();
    const refetchB = vi.fn();
    const { result } = setup([
      { key: "a", error: down, isFetching: false, refetch: refetchA },
      { key: "b", error: null, isFetching: false, refetch: refetchB },
    ]);
    expect([...result.current.keys()]).toEqual(["a"]);
    expect(result.current.get("a")).toMatchObject({ error: down, isFetching: false });
    act(() => {
      result.current.get("a")?.retry();
    });
    expect(refetchA).toHaveBeenCalledTimes(1);
    expect(refetchB).not.toHaveBeenCalled();
  });

  it("keeps a query's error while its retry runs and drops it when the retry succeeds", () => {
    const refetch = vi.fn();
    const other = { key: "b", error: down, isFetching: false, refetch: vi.fn() };
    const { result, rerender } = setup([{ key: "a", error: down, isFetching: false, refetch }, other]);
    act(() => {
      result.current.get("a")?.retry();
    });
    // TanStack resets a no-data query to pending, error cleared, while it refetches.
    rerender([{ key: "a", error: null, isFetching: true, refetch }, other]);
    expect(result.current.get("a")).toMatchObject({ error: down, isFetching: true });
    expect(result.current.get("b")).toMatchObject({ error: down, isFetching: false });
    rerender([{ key: "a", error: null, isFetching: false, refetch }, other]);
    expect(result.current.has("a")).toBe(false);
    expect(result.current.has("b")).toBe(true);
  });

  it("shows the retry's own error once it answers", () => {
    const refetch = vi.fn();
    const again = new Error("The BV-BRC data service did not respond.");
    const { result, rerender } = setup([{ key: "a", error: down, isFetching: false, refetch }]);
    act(() => {
      result.current.get("a")?.retry();
    });
    rerender([{ key: "a", error: null, isFetching: true, refetch }]);
    rerender([{ key: "a", error: again, isFetching: false, refetch }]);
    expect(result.current.get("a")).toMatchObject({ error: again, isFetching: false });
    // The kept error is gone: a later refetch without one does not bring it back.
    rerender([{ key: "a", error: null, isFetching: true, refetch }]);
    expect(result.current.has("a")).toBe(false);
  });

  it("forgets a kept error whose query is gone", () => {
    const refetch = vi.fn();
    const { result, rerender } = setup([{ key: "a", error: down, isFetching: false, refetch }]);
    act(() => {
      result.current.get("a")?.retry();
    });
    rerender([]);
    expect(result.current.size).toBe(0);
    rerender([{ key: "a", error: null, isFetching: true, refetch }]);
    expect(result.current.size).toBe(0);
  });
});

describe("useCircularTrackData", () => {
  const contigs = [{ accession: "NC_1", sequenceId: "s1", length: 50_000 }];
  const query = { type: "CDS", strand: "both", keyword: "secretion" } as const;
  const found = { featureId: "F1", accession: "NC_1", start: 1, end: 900, strand: "+", featureType: "CDS" };

  function serveTracks() {
    let customCalls = 0;
    server.use(
      http.get("*/api/circular-viewer/track", () => HttpResponse.json({ features: [], truncated: false })),
      http.get("*/api/circular-viewer/gc", () =>
        HttpResponse.json({ windowSize: 50, contigs: [{ accession: "NC_1", length: 50_000, gc: [0.5], skew: [0] }] }),
      ),
      http.get("*/api/circular-viewer/custom", () => {
        customCalls += 1;
        return HttpResponse.json({ features: [found], truncated: false });
      }),
    );
    return { customCalls: () => customCalls };
  }

  it("reads two custom tracks with one query once, and gives both its answer", async () => {
    const calls = serveTracks();
    const warn = vi.spyOn(console, "warn");
    try {
      const tracks = [customTrack(1, query, ""), customTrack(2, query, "Again")];
      const { result } = renderHook(() => useCircularTrackData("1.1", tracks, contigs), {
        wrapper: createQueryClientWrapper(),
      });
      await waitFor(() => {
        expect(result.current.data.get("custom-1")?.status).toBe("ready");
      });
      for (const id of ["custom-1", "custom-2"]) {
        expect(result.current.data.get(id)).toEqual({
          status: "ready",
          items: { kind: "features", features: [found], truncated: false },
        });
      }
      expect(calls.customCalls()).toBe(1);
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("Duplicate Queries"));
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps every unchanged track's items across renders and a recolor", async () => {
    serveTracks();
    const initial = [...defaultTracks(), customTrack(1, query, "")];
    const { result, rerender } = renderHook(
      ({ tracks }: { tracks: readonly CircularTrack[] }) => useCircularTrackData("1.1", tracks, contigs),
      { wrapper: createQueryClientWrapper(), initialProps: { tracks: initial } },
    );
    await waitFor(() => {
      expect([...result.current.data.values()].every((answer) => answer.status === "ready")).toBe(true);
    });
    const itemsOf = () =>
      new Map(
        [...result.current.data].map(([id, answer]) => [id, answer.status === "ready" ? answer.items : undefined]),
      );
    const before = itemsOf();
    rerender({ tracks: initial.map((track) => (track.id === "amr" ? { ...track, foreground: "#123456" } : track)) });
    const after = itemsOf();
    expect(after.size).toBe(before.size);
    for (const [id, items] of before) expect(after.get(id)).toBe(items);
  });
});
