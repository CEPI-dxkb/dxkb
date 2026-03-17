import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

import { useJobsData } from "../use-jobs-data";

const defaultParams = {
  offset: 0,
  limit: 25,
  includeArchived: false,
  sortField: "submit_time",
  sortOrder: "desc" as const,
};

describe("useJobsData", () => {
  it("returns jobs data on success", async () => {
    const jobs = [
      { id: "job-1", app: "GenomeAssembly2", status: "completed" },
      { id: "job-2", app: "GenomeAnnotation", status: "queued" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs }),
    });

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(jobs);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/app-service/jobs/enumerate-tasks-filtered",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          offset: 0,
          limit: 25,
          include_archived: false,
          sort_field: "submit_time",
          sort_order: "desc",
        }),
      }),
    );
  });

  it("unwraps nested array when raw[0] is an array", async () => {
    const jobs = [
      { id: "job-1", app: "GenomeAssembly2", status: "completed" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [jobs] }),
    });

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(jobs);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => useJobsData(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe(
      "Failed to fetch jobs: Internal Server Error",
    );
  });
});
