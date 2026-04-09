import { http, HttpResponse } from "msw";
import { NextRequest, NextResponse } from "next/server";
import { server } from "@/test-helpers/msw-server";
import { json } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({ requireAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn((key: string) => {
    if (key === "SHOCK_ORIGINS") return "http://allowed-shock.example.com";
    return "http://mock-api";
  }),
}));

import { requireAuthToken } from "@/lib/auth/session";
const mockRequireAuthToken = vi.mocked(requireAuthToken);

function defaultGetRequiredEnv(key: string) {
  if (key === "SHOCK_ORIGINS") return "http://allowed-shock.example.com";
  return "http://mock-api";
}

/**
 * Create a NextRequest with a mocked formData() method, because
 * jsdom's File objects are not compatible with Node 24's undici multipart parser.
 */
function makeUploadRequest(
  formEntries: Record<string, string | File>,
): NextRequest {
  const req = new NextRequest(
    "http://localhost:3019/api/services/workspace/upload",
    { method: "POST" },
  );

  // Build a real FormData from the entries
  const fd = new FormData();
  for (const [key, value] of Object.entries(formEntries)) {
    if (value instanceof File) {
      // Re-create as a Blob so it passes instanceof File in Node
      fd.append(key, value, value.name);
    } else {
      fd.append(key, value);
    }
  }

  // Override formData() to return our manually constructed FormData
  vi.spyOn(req, "formData").mockResolvedValue(fd);

  return req;
}

describe("POST /api/services/workspace/upload", () => {
  let POST: (req: NextRequest) => Promise<NextResponse>;

  beforeEach(async () => {
    const { getRequiredEnv } = await import("@/lib/env");
    vi.mocked(getRequiredEnv).mockImplementation(defaultGetRequiredEnv);

    const mod = await import("../route");
    POST = mod.POST;
  });

  it("returns 503 when SHOCK_ORIGINS is not set", async () => {
    const { getRequiredEnv } = await import("@/lib/env");
    vi.mocked(getRequiredEnv).mockImplementation((key: string) => {
      if (key === "SHOCK_ORIGINS") throw new Error("missing");
      return "http://mock-api";
    });

    mockRequireAuthToken.mockResolvedValue("token");

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    const res = await POST(req);

    expect(res.status).toBe(503);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("SHOCK_ORIGINS"),
      }),
    );
  });

  it("returns 401 when no auth token", async () => {
    mockRequireAuthToken.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns 400 when url is missing", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({ file });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("url") }),
    );
  });

  it("returns 400 when file is missing", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("file") }),
    );
  });

  it("returns 400 when URL is not in allowlist", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://evil.example.com/node/123",
      file,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("not an allowed Shock endpoint"),
      }),
    );
  });

  it("prepends OAuth prefix to auth token", async () => {
    mockRequireAuthToken.mockResolvedValue("my-raw-token");

    let capturedHeaders: Headers | undefined;
    server.use(
      http.put("http://allowed-shock.example.com/node/123", async ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ data: null });
      }),
    );

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    await POST(req);

    expect(capturedHeaders?.get("Authorization")).toBe("OAuth my-raw-token");
  });

  it("does not double-prepend OAuth if already present", async () => {
    mockRequireAuthToken.mockResolvedValue("OAuth existing-token");

    let capturedHeaders: Headers | undefined;
    server.use(
      http.put("http://allowed-shock.example.com/node/123", async ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ data: null });
      }),
    );

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    await POST(req);

    expect(capturedHeaders?.get("Authorization")).toBe("OAuth existing-token");
  });

  it("returns data on successful upload", async () => {
    mockRequireAuthToken.mockResolvedValue("token");
    const responseData = { data: { id: "node-id" } };

    server.use(
      http.put("http://allowed-shock.example.com/node/123", () => {
        return HttpResponse.json(responseData);
      }),
    );

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(responseData);
  });

  it("returns upstream error on non-ok response", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.put("http://allowed-shock.example.com/node/123", () => {
        return HttpResponse.text("upload failed", { status: 500 });
      }),
    );

    const file = new File(["content"], "test.fasta", { type: "text/plain" });
    const req = makeUploadRequest({
      url: "http://allowed-shock.example.com/node/123",
      file,
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Shock upload failed"),
      }),
    );
  });
});
