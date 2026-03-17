import { http, HttpResponse } from "msw";
import { renderHook } from "@testing-library/react";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import { server } from "@/test-helpers/msw-server";

const { mockRefreshAuth } = vi.hoisted(() => ({
  mockRefreshAuth: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));

describe("useAuthenticatedFetch", () => {
  it("sends request with credentials: 'include' and Content-Type header", async () => {
    let capturedHeaders: Headers | null = null;
    server.use(
      http.all("/api/test", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/test");

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });

  it("returns response directly on success (non-401)", async () => {
    server.use(
      http.all("/api/test", () => HttpResponse.json({ data: "test" })),
    );

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    const response = await fetchFn("/api/test");
    const data = await response.json();

    expect(data).toEqual({ data: "test" });
    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it("calls refreshAuth on 401 and retries the request", async () => {
    let callCount = 0;
    server.use(
      http.all("/api/protected", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse("Unauthorized", { status: 401 });
        }
        return HttpResponse.json({ data: "retried" });
      }),
    );
    mockRefreshAuth.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/protected");

    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(2);
  });

  it("returns the retry response on 401", async () => {
    let callCount = 0;
    server.use(
      http.all("/api/protected", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse("Unauthorized", { status: 401 });
        }
        return HttpResponse.json({ data: "success" });
      }),
    );
    mockRefreshAuth.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    const response = await fetchFn("/api/protected");
    const data = await response.json();

    expect(data).toEqual({ data: "success" });
  });

  it("passes through custom headers from options", async () => {
    let capturedHeaders: Headers | null = null;
    server.use(
      http.all("/api/test", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result } = renderHook(() => useAuthenticatedFetch());
    const fetchFn = result.current;

    await fetchFn("/api/test", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
        "X-Custom-Header": "custom-value",
      },
    });

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.get("authorization")).toBe("Bearer token123");
    expect(capturedHeaders?.get("x-custom-header")).toBe("custom-value");
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });
});
