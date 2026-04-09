import { NextResponse } from "next/server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "../[...path]/route";

vi.mock("../../resolve-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../resolve-download")>()),
  resolveWorkspaceDownload: vi.fn(),
}));

import { resolveWorkspaceDownload } from "../../resolve-download";
const mockResolve = vi.mocked(resolveWorkspaceDownload);

function makeParams(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("GET /api/workspace/view/[...path]", () => {
  it("streams file content with correct headers", async () => {
    const shockResponse = new Response("file content here", {
      headers: {
        "Content-Length": "17",
        "Content-Type": "text/plain",
      },
    });

    mockResolve.mockResolvedValue({
      shockResponse,
      filename: "data.fasta",
      contentType: "text/plain",
    });

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/data.fasta",
    });
    const res = await GET(req, makeParams(["user", "home", "data.fasta"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="data.fasta"');
    expect(res.headers.get("Content-Length")).toBe("17");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("omits Content-Length when not present in shock response", async () => {
    const shockResponse = new Response("streamed content");

    mockResolve.mockResolvedValue({
      shockResponse,
      filename: "output.json",
      contentType: "application/json",
    });

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/output.json",
    });
    const res = await GET(req, makeParams(["user", "home", "output.json"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    // Content-Length should not be set when upstream doesn't provide it
    expect(res.headers.has("Content-Length")).toBe(false);
  });

  it("passes through 401 from resolveWorkspaceDownload", async () => {
    mockResolve.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(401);
  });

  it("passes through 404 from resolveWorkspaceDownload", async () => {
    mockResolve.mockResolvedValue(
      NextResponse.json({ error: "Download URL not found" }, { status: 404 }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/missing.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "missing.txt"]));

    expect(res.status).toBe(404);
  });

  it("passes through 502 from resolveWorkspaceDownload", async () => {
    mockResolve.mockResolvedValue(
      NextResponse.json({ error: "Failed to fetch file content" }, { status: 502 }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(502);
  });

  it("returns 500 on unexpected errors", async () => {
    mockResolve.mockRejectedValue(new Error("unexpected crash"));

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/user/home/file.txt",
    });
    const res = await GET(req, makeParams(["user", "home", "file.txt"]));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("handles empty path segments gracefully", async () => {
    const shockResponse = new Response("data");

    mockResolve.mockResolvedValue({
      shockResponse,
      filename: "download",
      contentType: "application/octet-stream",
    });

    const req = mockNextRequest({
      url: "http://localhost:3019/api/workspace/view/",
    });
    const res = await GET(req, makeParams([]));

    expect(res.status).toBe(200);
  });
});
