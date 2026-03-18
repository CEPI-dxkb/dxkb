import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/api-error";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));

import { useApiQuery, useApiMutation } from "../use-api-query";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

describe("useApiQuery", () => {
  beforeEach(() => mockFetch.mockReset());

  it("fetches JSON and returns data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [1, 2] }),
    });

    const { result } = renderHook(
      () =>
        useApiQuery({
          url: "/api/test",
          queryKey: ["test"],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [1, 2] });
  });

  it("sends POST body when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    renderHook(
      () =>
        useApiQuery({
          url: "/api/test",
          method: "POST",
          body: { filter: "active" },
          queryKey: ["test-post"],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/api/test", {
        method: "POST",
        body: JSON.stringify({ filter: "active" }),
      }),
    );
  });

  it("applies select transform", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { nested: 42 } }),
    });

    const { result } = renderHook(
      () =>
        useApiQuery<number>({
          url: "/api/test",
          queryKey: ["test-select"],
          select: (d) => (d as { data: { nested: number } }).data.nested,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(42);
  });

  it("supports text responseType", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "plain text output",
    });

    const { result } = renderHook(
      () =>
        useApiQuery<string>({
          url: "/api/test",
          queryKey: ["test-text"],
          responseType: "text",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("plain text output");
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const { result } = renderHook(
      () =>
        useApiQuery({
          url: "/api/test",
          queryKey: ["test-error"],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(403);
  });

  it("passes through queryOptions", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(
      () =>
        useApiQuery({
          url: "/api/test",
          queryKey: ["test-disabled"],
          queryOptions: { enabled: false },
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useApiMutation", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends mutation and returns data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation<{ success: boolean }, { name: string }>({
          url: "/api/mutate",
          buildBody: (vars) => vars,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({ name: "test" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith("/api/mutate", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
  });

  it("supports dynamic URL from variables", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ killed: true }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation<{ killed: boolean }, string>({
          url: (jobId) => `/api/jobs/${jobId}/kill`,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate("job-123");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/jobs/job-123/kill", {
      method: "POST",
    });
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal error",
    });

    const { result } = renderHook(
      () =>
        useApiMutation({
          url: "/api/fail",
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(500);
  });

  it("applies select transform", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wrapper: { id: 99 } }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation<number, undefined>({
          url: "/api/test",
          select: (d) => (d as { wrapper: { id: number } }).wrapper.id,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(99);
  });
});
