import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { ApiCallError } from "@/lib/api/types";
import { nextRefetchInterval } from "@/test-helpers/react";

function createWrapper(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

import { useJobsSummary } from "../use-jobs-summary";

describe("useJobsSummary", () => {
  it("returns summary data on success", async () => {
    const taskSummary = { completed: 10, failed: 2 };
    const appSummary = { GenomeAssembly2: 5, GenomeAnnotation: 7 };

    let capturedBody: unknown;
    server.use(
      http.post("/api/services/app-service/jobs/summary", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ taskSummary, appSummary });
      }),
    );

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ taskSummary, appSummary });
    expect(capturedBody).toEqual(expect.objectContaining({ include_archived: false }));
  });

  it("unwraps array-wrapped summaries", async () => {
    const taskSummary = { completed: 3, running: 1 };
    const appSummary = { Blast: 4 };

    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        return HttpResponse.json({
          taskSummary: [taskSummary],
          appSummary: [appSummary],
        });
      }),
    );

    const { result } = renderHook(() => useJobsSummary(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ taskSummary, appSummary });
  });

  it("returns active job data correctly", async () => {
    const taskSummary = { running: 1 };
    const appSummary = { GenomeAssembly2: 1 };

    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        return HttpResponse.json({ taskSummary, appSummary });
      }),
    );

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ taskSummary, appSummary });
  });

  it("throws ApiCallError on HTTP error", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        return new HttpResponse(null, { status: 502, statusText: "Bad Gateway" });
      }),
    );

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });

    expect(result.current.error).toBeInstanceOf(ApiCallError);
    expect(result.current.error?.status).toBe(502);
  });

  it("backs off instead of polling a failing summary at the 5 s no-data rate", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", () =>
        HttpResponse.json({ error: "JSON-RPC call failed: fetch failed" }, { status: 500 }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });

    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(30_000);
  });

  it("polls active jobs at the fast rate once the summary succeeds", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", () =>
        HttpResponse.json({ taskSummary: { running: 1 }, appSummary: {} }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(3_000);
  });

  it("fetches once and does not poll when poll is false", async () => {
    let calls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        calls += 1;
        return HttpResponse.json({ taskSummary: { running: 1 }, appSummary: {} });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useJobsSummary(false, { poll: false }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(calls).toBe(1);
    // Running jobs would otherwise poll every 3 s.
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(false);
  });
});
