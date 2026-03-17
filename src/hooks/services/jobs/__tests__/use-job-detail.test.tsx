import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));

vi.mock("@/lib/jobs/constants", () => ({
  activeJobStatuses: ["pending", "queued", "running", "in-progress"],
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

import { useJobDetail, useJobOutput } from "../use-job-detail";

describe("useJobDetail", () => {
  it("returns job detail on success", async () => {
    const jobDetail = {
      id: "abc-123",
      app: "GenomeAssembly2",
      status: "completed",
      submit_time: "2026-01-15T10:00:00Z",
      parameters: { recipe: "auto" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => jobDetail,
    });

    const { result } = renderHook(() => useJobDetail("abc-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(jobDetail);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/app-service/jobs/abc-123",
    );
  });

  it("is disabled when jobId is null", () => {
    const { result } = renderHook(() => useJobDetail(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useJobOutput", () => {
  it("returns text output on success", async () => {
    const outputText = "Assembly started\nContigs generated: 42\nDone.";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => outputText,
    });

    const { result } = renderHook(
      () => useJobOutput("abc-123", "stdout", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(outputText);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/app-service/jobs/abc-123/stdout",
    );
  });

  it("is disabled when enabled is false", () => {
    const { result } = renderHook(
      () => useJobOutput("abc-123", "stdout", false),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });

    const { result } = renderHook(
      () => useJobOutput("abc-123", "stderr", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toContain("Failed to fetch stderr");
  });
});
