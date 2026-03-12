import { renderHook } from "@testing-library/react";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";

const mockRefreshAuth = vi.fn();

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));

describe("useAuthenticatedFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends request with credentials: 'include' and Content-Type header", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/test");

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/test", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("returns response directly on success (non-401)", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "test" }), {
      status: 200,
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    const response = await fetchFn("/api/test");

    expect(response).toBe(mockResponse);
    expect(mockRefreshAuth).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("calls refreshAuth on 401 and retries the request", async () => {
    const unauthorizedResponse = new Response("Unauthorized", { status: 401 });
    const retryResponse = new Response(JSON.stringify({ data: "retried" }), {
      status: 200,
    });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(retryResponse);
    mockRefreshAuth.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/protected");

    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Both calls should have the same URL and options
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, "/api/protected", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, "/api/protected", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("returns the retry response on 401", async () => {
    const unauthorizedResponse = new Response("Unauthorized", { status: 401 });
    const retryResponse = new Response(JSON.stringify({ data: "success" }), {
      status: 200,
    });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(retryResponse);
    mockRefreshAuth.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    const response = await fetchFn("/api/protected");

    expect(response).toBe(retryResponse);
  });

  it("passes through custom headers from options", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/test", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
        "X-Custom-Header": "custom-value",
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: "Bearer token123",
        "X-Custom-Header": "custom-value",
        "Content-Type": "application/json",
      },
    });
  });
});
