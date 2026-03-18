import { NextResponse } from "next/server";
import {
  mockNextRequest,
  makeRouteContext,
} from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({
  getBvbrcAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { protectedRoute, type RouteContext } from "../protected-route";
import { getBvbrcAuthToken } from "@/lib/auth";
import { createAppService } from "@/lib/app-service";
import { JsonRpcError } from "@/lib/jsonrpc-client";
import { ApiError } from "../api-error";

const mockGetToken = vi.mocked(getBvbrcAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = { killJob: vi.fn() };

describe("protectedRoute", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token and requireAuth is true", async () => {
    mockGetToken.mockResolvedValue(undefined);

    const handler = protectedRoute(async () => ({ ok: true }));
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("skips auth check when requireAuth is false", async () => {
    mockGetToken.mockResolvedValue(undefined);

    const handler = protectedRoute(async () => ({ ok: true }), {
      requireAuth: false,
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("provides token, appService, params, and searchParams to handler", async () => {
    mockGetToken.mockResolvedValue("test-token");

    let captured: RouteContext | undefined;
    const handler = protectedRoute(async (ctx) => {
      captured = ctx;
      return { ok: true };
    });

    await handler(
      mockNextRequest({
        url: "http://localhost:3019/api/test?foo=bar",
      }),
      makeRouteContext("abc"),
    );

    expect(captured).toEqual(
      expect.objectContaining({
        token: "test-token",
        params: { id: "abc" },
      }),
    );
    expect(captured?.searchParams.get("foo")).toBe("bar");
    expect(captured?.appService).toBeDefined();
  });

  it("serializes handler return value as JSON", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => ({ data: [1, 2, 3] }));
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [1, 2, 3] });
  });

  it("passes through NextResponse returned by handler", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () =>
      NextResponse.json({ custom: true }, { status: 201 }),
    );
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ custom: true });
  });

  it("uses formatResponse when provided", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(
      async () => "plain text output",
      {
        formatResponse: (result) =>
          new NextResponse(result as string, {
            headers: { "Content-Type": "text/plain" },
          }),
      },
    );
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(await res.text()).toBe("plain text output");
  });

  it("catches ApiError and returns its status/body", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => {
      throw new ApiError(422, { error: "Invalid input" });
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Invalid input" });
  });

  it("catches ApiError with string body", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => {
      throw new ApiError(400, "Bad request");
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Bad request" });
  });

  it("catches JsonRpcError and returns 500 with code/data", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => {
      throw new JsonRpcError("RPC failed", -32603, { detail: "timeout" });
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "RPC failed",
      code: -32603,
      data: { detail: "timeout" },
    });
  });

  it("catches generic Error and returns 500", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => {
      throw new Error("Something broke");
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something broke" });
  });

  it("catches non-Error throws and returns 500", async () => {
    mockGetToken.mockResolvedValue("token");

    const handler = protectedRoute(async () => {
      throw "string error";
    });
    const res = await handler(mockNextRequest(), makeRouteContext("1"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
