const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, withAuth, withOptionalAuth, withErrorHandling } from "../server";
import { JsonRpcError, jsonRpcErrorCodes } from "@/lib/jsonrpc-client";

describe("errorResponse", () => {
  it("preserves a plain Error message with status 500", async () => {
    const response = errorResponse(new Error("something broke"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        error: "something broke",
        code: "upstream",
      }),
    );
  });

  it("preserves the Error message when the fallback status is 4xx", async () => {
    const response = errorResponse(new Error("not found"), 404);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({ error: "not found", code: "upstream" }),
    );
  });

  it("preserves JsonRpcError messages when the mapped status is 5xx", async () => {
    const rpcError = new JsonRpcError(
      "db host=prod-replica timeout",
      jsonRpcErrorCodes.INTERNAL_ERROR,
    );
    const response = errorResponse(rpcError);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("db host=prod-replica timeout");
  });

  it("preserves JsonRpcError.data as details and maps code to HTTP status", async () => {
    const rpcError = new JsonRpcError("Not found", jsonRpcErrorCodes.NOT_FOUND, {
      resource: "genome",
    });
    const response = errorResponse(rpcError);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        error: "Not found",
        code: "not_found",
        details: { resource: "genome" },
      }),
    );
  });

  it("maps UNAUTHORIZED RPC code to 401", async () => {
    const rpcError = new JsonRpcError("Access denied", jsonRpcErrorCodes.UNAUTHORIZED);
    const response = errorResponse(rpcError);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("unauthenticated");
  });

  it("maps VALIDATION_ERROR RPC code to 400", async () => {
    const rpcError = new JsonRpcError("Bad input", jsonRpcErrorCodes.VALIDATION_ERROR, {
      field: "genome_id",
    });
    const response = errorResponse(rpcError);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("validation");
    expect(body.details).toEqual({ field: "genome_id" });
  });

  it("falls back to 500 for unknown RPC codes", async () => {
    const rpcError = new JsonRpcError("Internal error", jsonRpcErrorCodes.INTERNAL_ERROR);
    const response = errorResponse(rpcError);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("upstream");
  });

  it("handles non-Error values", async () => {
    const response = errorResponse("string error");
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({ error: "Unknown error", code: "unknown" }),
    );
  });

  it("maps thrown AuthError shape to its code-derived status", async () => {
    const response = errorResponse({
      message: "Invalid credentials",
      code: "invalid_credentials",
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        error: "Invalid credentials",
        code: "unauthenticated",
      }),
    );
  });

  it("honors an explicit status on an AuthError shape", async () => {
    const response = errorResponse({
      message: "Conflict",
      code: "conflict",
      status: 422,
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("Conflict");
    expect(body.code).toBe("validation");
  });
});

describe("withAuth", () => {
  function makeRequest(
    url = "http://localhost/api/test",
    init?: RequestInit,
  ): NextRequest {
    return new NextRequest(url, init);
  }

  it("injects token into the handler when authenticated", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_token") return { value: "test-token-value" };
      return undefined;
    });

    const handler = withAuth(async (_req, { token }) => {
      return NextResponse.json({ received: token });
    });

    const response = await handler(makeRequest(), {});
    const body = await response.json();
    expect(body.received).toBe("test-token-value");
  });

  it("returns 401 when not authenticated", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const handler = withAuth(async () => {
      return NextResponse.json({ should: "not reach" });
    });

    const response = await handler(makeRequest(), {});
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  it("catches thrown errors and returns errorResponse", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_token") return { value: "token" };
      return undefined;
    });

    const handler = withAuth(async () => {
      throw new Error("handler exploded");
    });

    const response = await handler(makeRequest(), {});
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("handler exploded");
  });
});

describe("withOptionalAuth", () => {
  function makeRequest(
    url = "http://localhost/api/test",
    init?: RequestInit,
  ): NextRequest {
    return new NextRequest(url, init);
  }

  it("injects token as undefined when not authenticated", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const handler = withOptionalAuth(async (_req, { token }) => {
      return NextResponse.json({ token: token ?? "none" });
    });

    const response = await handler(makeRequest(), {});
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe("none");
  });

  it("injects token when authenticated", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_token") return { value: "my-token" };
      return undefined;
    });

    const handler = withOptionalAuth(async (_req, { token }) => {
      return NextResponse.json({ token });
    });

    const response = await handler(makeRequest(), {});
    const body = await response.json();
    expect(body.token).toBe("my-token");
  });
});

describe("withErrorHandling", () => {
  function makeRequest(
    url = "http://localhost/api/test",
    init?: RequestInit,
  ): NextRequest {
    return new NextRequest(url, init);
  }

  it("passes through the handler response on success", async () => {
    const handler = withErrorHandling(async () => {
      return NextResponse.json({ ok: true });
    });

    const response = await handler(makeRequest(), {});
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("catches thrown errors and returns errorResponse", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("boom");
    });

    const response = await handler(makeRequest(), {});
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("boom");
  });

  it("does not read auth cookies", async () => {
    mockCookieStore.get.mockClear();

    const handler = withErrorHandling(async () => {
      return NextResponse.json({ ok: true });
    });

    await handler(makeRequest(), {});
    expect(mockCookieStore.get).not.toHaveBeenCalled();
  });
});
