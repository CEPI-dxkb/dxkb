import { NextResponse } from "next/server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "../[...path]/route";

// Mock resolveWorkspaceDownload — the preview route depends on it
vi.mock("../../resolve-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../resolve-download")>()),
  resolveWorkspaceDownload: vi.fn(),
}));

import { resolveWorkspaceDownload } from "../../resolve-download";
const mockResolve = vi.mocked(resolveWorkspaceDownload);

/** Helper to build a resolved download with a readable body. */
function makeResolvedDownload(
  body: string,
  opts: { contentLength?: number; filename?: string; contentType?: string } = {},
) {
  const {
    contentLength,
    filename = "test.txt",
    contentType = "text/plain",
  } = opts;

  const headers = new Headers();
  if (contentLength !== undefined) {
    headers.set("Content-Length", String(contentLength));
  }

  const shockResponse = new Response(body, { headers });

  return { shockResponse, filename, contentType };
}

function makeParams(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("GET /api/workspace/preview/[...path]", () => {
  it("returns full file when Content-Length <= maxBytes", async () => {
    const content = "line1\nline2\nline3\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBeNull();
    expect(res.headers.get("Content-Length")).toBe(String(content.length));
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain("test.txt");
  });

  it("truncates large files at the last newline boundary", async () => {
    // Create content larger than a small maxBytes limit
    const line = "abcdefghij\n"; // 11 bytes each
    const content = line.repeat(10); // 110 bytes
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "50" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBe("true");

    const body = await res.text();
    // Should be truncated to last newline <= 50 bytes
    // 4 complete lines = 44 bytes
    expect(body.length).toBeLessThanOrEqual(50);
    expect(body.endsWith("\n")).toBe(true);
  });

  it("uses default maxBytes (2MB) when param is missing", async () => {
    const content = "small file\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    // Small file should be returned in full (no truncation)
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBeNull();
  });

  it("caps maxBytes at 10MB", async () => {
    const content = "small\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    // Request 100MB — should be capped at 10MB internally
    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "104857600" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
  });

  it("falls back to default for non-numeric maxBytes", async () => {
    const content = "hello\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "not-a-number" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
  });

  it("enforces minimum maxBytes of 1", async () => {
    const content = "a\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "0" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    // maxBytes=0 is clamped to 1, file is 2 bytes so will truncate
    expect(res.status).toBe(200);
  });

  it("passes through error from resolveWorkspaceDownload", async () => {
    mockResolve.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(401);
  });

  it("reads exact number of bytes when file fits in maxBytes exactly", async () => {
    const content = "12345\n"; // exactly 6 bytes
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "6" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
    // File fits exactly in maxBytes, should not be truncated
    expect(res.headers.get("X-Truncated")).toBeNull();
    const body = await res.text();
    expect(body).toBe("12345\n");
  });

  it("keeps all bytes when truncated content has no newlines", async () => {
    // Binary-like content with no newlines at all
    const content = "x".repeat(100);
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.bin",
      searchParams: { maxBytes: "50" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.bin"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBe("true");
    const body = await res.text();
    // No newlines, so lastNewline is -1, slice is skipped: all 50 bytes kept
    expect(body.length).toBe(50);
  });

  it("handles unknown Content-Length (streams and truncates)", async () => {
    // When Content-Length is not set, we go to the stream-reading path
    const line = "0123456789\n"; // 11 bytes
    const content = line.repeat(10); // 110 bytes
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content), // no contentLength set
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "50" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.length).toBeLessThanOrEqual(50);
    expect(body.endsWith("\n")).toBe(true);
  });

  it("sets Cache-Control header", async () => {
    const content = "data\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("returns 500 on unexpected errors", async () => {
    mockResolve.mockRejectedValue(new Error("unexpected"));

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
