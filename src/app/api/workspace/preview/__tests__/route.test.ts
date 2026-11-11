import { NextResponse } from "next/server";
import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";
import { GET } from "../[...path]/route";

vi.mock("../../resolve-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../resolve-download")>()),
  resolveWorkspaceDownload: vi.fn(),
}));

import { resolveWorkspaceDownload } from "../../resolve-download";
const mockResolve = vi.mocked(resolveWorkspaceDownload);

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
  return makeRouteContext({ path });
}

describe("GET /api/workspace/preview/[...path]", () => {
  it("sandboxes a small file returned whole", async () => {
    const content = "<svg><script>alert(1)</script></svg>";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, {
        contentLength: content.length,
        filename: "figure.svg",
        contentType: "image/svg+xml",
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/figure.svg",
    });
    const res = await GET(req, makeParams(["user", "home", "figure.svg"]));

    expect(res.headers.get("X-Truncated")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sandboxes a truncated file too", async () => {
    const content = "<p>line</p>\n".repeat(20);
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, {
        filename: "report.html",
        contentType: "text/html",
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/report.html",
      searchParams: { maxBytes: "30" },
    });
    const res = await GET(req, makeParams(["user", "home", "report.html"]));

    expect(res.headers.get("X-Truncated")).toBe("true");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts allow-popups",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

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
    const line = "abcdefghij\n";
    const content = line.repeat(10);
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

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBeNull();
  });

  it("caps maxBytes at 10MB", async () => {
    const content = "small\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

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
    const content = "12345\n";
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content, { contentLength: content.length }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/preview/user/home/file.txt",
      searchParams: { maxBytes: "6" },
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Truncated")).toBeNull();
    const body = await res.text();
    expect(body).toBe("12345\n");
  });

  it("keeps all bytes when truncated content has no newlines", async () => {
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
    expect(body.length).toBe(50);
  });

  it("handles unknown Content-Length (streams and truncates)", async () => {
    const line = "0123456789\n";
    const content = line.repeat(10);
    mockResolve.mockResolvedValue(
      makeResolvedDownload(content),
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
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Internal server error");
  });
});
