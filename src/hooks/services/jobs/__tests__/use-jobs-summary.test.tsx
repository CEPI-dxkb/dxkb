import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { ApiCallError } from "@/lib/api/types";
import { nextRefetchInterval } from "@/test-helpers/react";
import { settleBackgroundWork } from "@/test-helpers/settle";
import { clearAccountCaches } from "@/lib/account-caches";
import { markJobSubmitted } from "@/lib/jobs/recent-submit";

function createWrapper(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

import { useJobsSummary, useJobsTaskSummary } from "../use-jobs-summary";

/** The app's query defaults (`src/app/providers.tsx`): no focus refetch, 60 s stale time. */
function appQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false },
    },
  });
}

afterEach(() => {
  clearAccountCaches();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

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

  it("polls at the fast rate for an init job", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", () =>
        HttpResponse.json({ taskSummary: { init: 1 }, appSummary: {} }),
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

  it("polls an empty summary every 3 s for 90 s after a submit, then every 30 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    server.use(
      http.post("/api/services/app-service/jobs/summary", () =>
        HttpResponse.json({ taskSummary: { completed: 4 }, appSummary: {} }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(30_000);

    markJobSubmitted();
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(3_000);

    vi.setSystemTime(Date.now() + 89_000);
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(3_000);

    vi.setSystemTime(Date.now() + 1_000);
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(30_000);
  });

  it("does not poll after a submit when poll is false", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", () =>
        HttpResponse.json({ taskSummary: {}, appSummary: {} }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useJobsSummary(false, { poll: false }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    markJobSubmitted();
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(false);
  });

  it("keeps the error back-off ahead of the submit window", async () => {
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

    markJobSubmitted();
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(30_000);
  });

  it("refetches even fresh counts when the window regains focus, unlike the app default", async () => {
    let calls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        calls += 1;
        return HttpResponse.json({ taskSummary: {}, appSummary: {} });
      }),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(appQueryClient()),
    });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(calls).toBe(1);

    // Fresh under the app's 60 s stale time: a plain `true` would skip this refetch.
    vi.setSystemTime(Date.now() + 5_000);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => { expect(calls).toBe(2); });
  });

  it("does not refetch on focus when poll is false", async () => {
    let calls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        calls += 1;
        return HttpResponse.json({ taskSummary: {}, appSummary: {} });
      }),
    );
    const { result } = renderHook(
      () => useJobsSummary(false, { poll: false }),
      { wrapper: createWrapper(appQueryClient()) },
    );
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await settleBackgroundWork();

    expect(calls).toBe(1);
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
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(false);
  });
});

describe("useJobsTaskSummary", () => {
  it("reads only task-summary and unwraps its { summary } answer", async () => {
    let summaryCalls = 0;
    let capturedBody: unknown;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        summaryCalls += 1;
        return HttpResponse.json({ taskSummary: {}, appSummary: {} });
      }),
      http.post("/api/services/app-service/jobs/task-summary", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ summary: [{ running: 2 }] });
      }),
    );

    const { result } = renderHook(() => useJobsTaskSummary(false), {
      wrapper: createWrapper(),
    });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ taskSummary: { running: 2 } });
    expect(capturedBody).toEqual(expect.objectContaining({ include_archived: false }));
    expect(summaryCalls).toBe(0);
  });

  it("is refreshed by invalidating the jobs-summary prefix and shares the polling policy", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/task-summary", () =>
        HttpResponse.json({ summary: { running: 1 } }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useJobsTaskSummary(false), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(nextRefetchInterval(queryClient, ["jobs-summary", "tasks", false])).toBe(3_000);
    await queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
    expect(queryClient.getQueryState(["jobs-summary", "tasks", false])?.dataUpdateCount).toBe(2);
  });

  it("refetches even fresh counts when the window regains focus, unlike the app default", async () => {
    let calls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/task-summary", () => {
        calls += 1;
        return HttpResponse.json({ summary: {} });
      }),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    const { result } = renderHook(() => useJobsTaskSummary(false), {
      wrapper: createWrapper(appQueryClient()),
    });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(calls).toBe(1);

    // Fresh under the app's 60 s stale time: a plain `true` would skip this refetch.
    vi.setSystemTime(Date.now() + 5_000);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => { expect(calls).toBe(2); });
  });

  it("does not refetch on focus when poll is false", async () => {
    let calls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/task-summary", () => {
        calls += 1;
        return HttpResponse.json({ summary: {} });
      }),
    );
    const { result } = renderHook(
      () => useJobsTaskSummary(false, { poll: false }),
      { wrapper: createWrapper(appQueryClient()) },
    );
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await settleBackgroundWork();

    expect(calls).toBe(1);
  });
});
