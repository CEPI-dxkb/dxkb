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

import { useJobsSummary } from "../use-jobs-summary";

describe("useJobsSummary", () => {
  it("returns summary data on success", async () => {
    const taskSummary = { completed: 10, failed: 2 };
    const appSummary = { GenomeAssembly2: 5, GenomeAnnotation: 7 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskSummary, appSummary }),
    });

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ taskSummary, appSummary });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/app-service/jobs/summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ include_archived: false }),
      }),
    );
  });

  it("unwraps array-wrapped summaries", async () => {
    const taskSummary = { completed: 3, running: 1 };
    const appSummary = { Blast: 4 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        taskSummary: [taskSummary],
        appSummary: [appSummary],
      }),
    });

    const { result } = renderHook(() => useJobsSummary(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ taskSummary, appSummary });
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Gateway",
    });

    const { result } = renderHook(() => useJobsSummary(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe(
      "Failed to fetch job summaries: Bad Gateway",
    );
  });
});
