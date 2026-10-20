import { act, renderHook, waitFor } from "@testing-library/react";
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

import { parseJobsResponse, useJobsData } from "../use-jobs-data";

const validJob = {
  id: "job-1",
  app: "GenomeAssembly2",
  status: "completed",
  submit_time: "2026-04-01T09:55:00Z",
  owner: "test-user",
  parameters: {},
};

const defaultParams = {
  offset: 0,
  limit: 25,
  includeArchived: false,
  sortField: "submit_time",
  sortOrder: "desc" as const,
};

describe("parseJobsResponse", () => {
  it.each([
    ["zero", 0, "0"],
    ["positive safe integer", 12345, "12345"],
    ["string", "00123", "00123"],
  ])("preserves job identity for a %s ID", (_case, id, expected) => {
    expect(
      parseJobsResponse({ jobs: [{ ...validJob, id }], totalTasks: 1 }).jobs[0]?.id,
    ).toBe(expected);
  });

  it("preserves optional and unknown upstream fields", () => {
    const job = {
      ...validJob,
      output_file: "result.txt",
      app_spec: {
        id: "GenomeAssembly2",
        script: "run.pl",
        label: "Genome Assembly",
        description: "Assemble a genome",
        upstreamMetadata: true,
      },
      upstreamField: { retained: true },
    };

    expect(parseJobsResponse({ jobs: [job], totalTasks: 1 })).toEqual({
      jobs: [job],
      totalTasks: 1,
    });
  });

  it("normalizes production AppService fields", () => {
    const job = {
      ...validJob,
      owner: undefined,
      user_id: "test-user@bvbrc",
      elapsed_time: "01:02:03",
    };

    expect(parseJobsResponse({ jobs: [job], totalTasks: 1 })).toEqual({
      jobs: [{ ...job, owner: "test-user@bvbrc", elapsed_time: 3723 }],
      totalTasks: 1,
    });
  });

  it("prefers owner when both owner fields are present", () => {
    const job = { ...validJob, user_id: "upstream-user" };

    expect(parseJobsResponse({ jobs: [job], totalTasks: 1 }).jobs[0]?.owner).toBe(
      validJob.owner,
    );
  });

  it.each([
    ["zero duration", "00:00:00", 0],
    ["multi-hour duration", "125:04:09", 450249],
    ["empty duration", "", undefined],
    ["numeric duration", 90.5, 90.5],
  ])("normalizes %s", (_case, elapsed_time, expected) => {
    const job = { ...validJob, elapsed_time };

    expect(
      parseJobsResponse({ jobs: [job], totalTasks: 1 }).jobs[0]?.elapsed_time,
    ).toBe(expected);
  });

  it.each([
    ["missing owner aliases", { ...validJob, owner: undefined }],
    ["empty owner", { ...validJob, owner: "" }],
    ["empty user ID", { ...validJob, owner: undefined, user_id: "" }],
    ["malformed duration", { ...validJob, elapsed_time: "01:2:03" }],
    ["out-of-range minutes", { ...validJob, elapsed_time: "01:60:00" }],
    ["out-of-range seconds", { ...validJob, elapsed_time: "01:00:60" }],
    ["negative duration", { ...validJob, elapsed_time: -1 }],
    ["null duration", { ...validJob, elapsed_time: null }],
  ])("rejects %s", (_case, job) => {
    expect(() => parseJobsResponse({ jobs: [job], totalTasks: 1 })).toThrow(
      "Invalid jobs response",
    );
  });

  it.each([
    ["null response", null],
    ["missing jobs", { totalTasks: 0 }],
    ["non-array jobs", { jobs: {}, totalTasks: 0 }],
    ["unsupported nested shape", { jobs: [[validJob], [validJob]], totalTasks: 2 }],
    ["missing total", { jobs: [] }],
    ["negative total", { jobs: [], totalTasks: -1 }],
    ["fractional total", { jobs: [], totalTasks: 1.5 }],
    ["string total", { jobs: [], totalTasks: "1" }],
    ["missing ID", { jobs: [{ ...validJob, id: undefined }], totalTasks: 1 }],
    ["null ID", { jobs: [{ ...validJob, id: null }], totalTasks: 1 }],
    ["empty ID", { jobs: [{ ...validJob, id: "" }], totalTasks: 1 }],
    ["negative numeric ID", { jobs: [{ ...validJob, id: -1 }], totalTasks: 1 }],
    ["fractional numeric ID", { jobs: [{ ...validJob, id: 1.5 }], totalTasks: 1 }],
    ["unsafe numeric ID", { jobs: [{ ...validJob, id: Number.MAX_SAFE_INTEGER + 1 }], totalTasks: 1 }],
    ["boolean ID", { jobs: [{ ...validJob, id: true }], totalTasks: 1 }],
    ["missing app", { jobs: [{ ...validJob, app: undefined }], totalTasks: 1 }],
    ["empty app", { jobs: [{ ...validJob, app: "" }], totalTasks: 1 }],
    ["unknown status", { jobs: [{ ...validJob, status: "killed" }], totalTasks: 1 }],
    ["missing submit time", { jobs: [{ ...validJob, submit_time: undefined }], totalTasks: 1 }],
    ["missing owner", { jobs: [{ ...validJob, owner: undefined }], totalTasks: 1 }],
    ["invalid parameters", { jobs: [{ ...validJob, parameters: [] }], totalTasks: 1 }],
    ["invalid output file", { jobs: [{ ...validJob, output_file: 4 }], totalTasks: 1 }],
  ])("throws for %s", (_case, response) => {
    expect(() => parseJobsResponse(response)).toThrow("Invalid jobs response");
  });
});

describe("useJobsData", () => {
  it("returns jobs data on success", async () => {
    const jobs = [
      validJob,
      { ...validJob, id: "job-2", app: "GenomeAnnotation", status: "queued" },
    ];

    let capturedBody: unknown;
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ jobs, totalTasks: 42 });
      }),
    );

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ jobs, totalTasks: 42 });
    expect(capturedBody).toEqual(
      expect.objectContaining({
        offset: 0,
        limit: 25,
        include_archived: false,
        sort_field: "submit_time",
        sort_order: "desc",
      }),
    );
  });

  it("normalizes numeric job IDs to strings", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () => {
        return HttpResponse.json({
          jobs: [{ ...validJob, id: 12345 }],
          totalTasks: 1,
        });
      }),
    );

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data?.jobs[0]?.id).toBe("12345");
  });

  it("unwraps nested array when raw[0] is an array", async () => {
    const jobs = [validJob];

    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () => {
        return HttpResponse.json({ jobs: [jobs], totalTasks: 10 });
      }),
    );

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({ jobs, totalTasks: 10 });
  });

  it("surfaces invalid response errors through the query", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () => {
        return HttpResponse.json({
          jobs: [{ ...validJob, id: null }],
          totalTasks: 1,
        });
      }),
    );

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("Invalid jobs response");
    expect(result.current.error?.message).toContain("id");
  });

  it("throws ApiCallError on HTTP error", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () => {
        return new HttpResponse(null, { status: 500, statusText: "Internal Server Error" });
      }),
    );

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });

    expect(result.current.error).toBeInstanceOf(ApiCallError);
    expect(result.current.error?.status).toBe(500);
  });

  it("keeps the caller's interval while polls succeed and backs off when they fail", async () => {
    let failing = false;
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () =>
        failing
          ? HttpResponse.json({ error: "JSON-RPC call failed: fetch failed" }, { status: 500 })
          : HttpResponse.json({ jobs: [validJob], totalTasks: 1 }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useJobsData({ ...defaultParams, refetchInterval: 10_000 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(10_000);

    failing = true;
    await act(() => result.current.refetch());
    expect(queryClient.getQueryCache().find({ queryKey: ["jobs-filtered"], exact: false })?.state.status).toBe("error");
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(30_000);

    await act(() => result.current.refetch());
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(60_000);

    failing = false;
    await act(() => result.current.refetch());
    expect(queryClient.getQueryCache().find({ queryKey: ["jobs-filtered"], exact: false })?.state.status).toBe("success");
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(10_000);
  });

  it("does not poll when the caller passes refetchInterval false, healthy or failing", async () => {
    let failing = false;
    server.use(
      http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () =>
        failing
          ? HttpResponse.json({ error: "JSON-RPC call failed: fetch failed" }, { status: 500 })
          : HttpResponse.json({ jobs: [validJob], totalTasks: 1 }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useJobsData({ ...defaultParams, refetchInterval: false }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(false);

    failing = true;
    await act(() => result.current.refetch());
    expect(queryClient.getQueryCache().find({ queryKey: ["jobs-filtered"], exact: false })?.state.status).toBe("error");
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(false);
  });
});
