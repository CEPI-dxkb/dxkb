import { NextResponse } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { buildWorkspacePath, resolveWorkspaceDownload } from "../resolve-download";

vi.mock("@/lib/auth/session", () => ({ requireAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-workspace-api"),
}));

import { requireAuthToken } from "@/lib/auth/session";
const mockRequireAuthToken = vi.mocked(requireAuthToken);

// ---------------------------------------------------------------------------
// buildWorkspacePath
// ---------------------------------------------------------------------------

describe("buildWorkspacePath", () => {
  it("joins segments with leading slash", () => {
    expect(buildWorkspacePath(["user@bvbrc", "home", "file.fasta"])).toBe(
      "/user@bvbrc/home/file.fasta",
    );
  });

  it("decodes URL-encoded segments", () => {
    expect(buildWorkspacePath(["user%40bvbrc", "my%20folder"])).toBe(
      "/user@bvbrc/my folder",
    );
  });

  it("returns root slash for empty segments", () => {
    expect(buildWorkspacePath([])).toBe("/");
  });

  it("handles single segment", () => {
    expect(buildWorkspacePath(["file.txt"])).toBe("/file.txt");
  });
});

// ---------------------------------------------------------------------------
// resolveWorkspaceDownload
// ---------------------------------------------------------------------------

describe("resolveWorkspaceDownload", () => {
  it("returns 401 NextResponse when not authenticated", async () => {
    mockRequireAuthToken.mockResolvedValue(
      NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    );

    const result = await resolveWorkspaceDownload(["user", "home", "file.txt"]);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns ResolvedDownload on success", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");

    const downloadUrl = "http://shock-server/download/abc123";

    // Mock workspace API to return download URL
    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: [[downloadUrl]],
          jsonrpc: "2.0",
        });
      }),
    );

    // Mock shock download
    server.use(
      http.get(downloadUrl, () => {
        return new HttpResponse("file content", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );

    const result = await resolveWorkspaceDownload(["user@bvbrc", "home", "data.fasta"]);

    expect(result).not.toBeInstanceOf(NextResponse);
    const resolved = result as { shockResponse: Response; filename: string; contentType: string };
    expect(resolved.filename).toBe("data.fasta");
    expect(resolved.contentType).toBe("text/plain");
    expect(resolved.shockResponse.ok).toBe(true);
  });

  it("sends correct JSON-RPC request with auth header", async () => {
    mockRequireAuthToken.mockResolvedValue("my-auth-token");

    let capturedBody: unknown;
    let capturedAuth: string | null = null;

    server.use(
      http.post("http://mock-workspace-api", async ({ request }) => {
        capturedBody = await request.json();
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({
          id: 1,
          result: [["http://shock/dl"]],
          jsonrpc: "2.0",
        });
      }),
      http.get("http://shock/dl", () => new HttpResponse("ok")),
    );

    await resolveWorkspaceDownload(["user%40bvbrc", "home", "file.txt"]);

    expect(capturedAuth).toBe("my-auth-token");
    expect(capturedBody).toEqual(
      expect.objectContaining({
        method: "Workspace.get_download_url",
        params: [{ objects: ["/user@bvbrc/home/file.txt"] }],
        jsonrpc: "2.0",
      }),
    );
  });

  it("returns error response when workspace API fails", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return new HttpResponse("Internal Server Error", { status: 500 });
      }),
    );

    const result = await resolveWorkspaceDownload(["user", "home", "file.txt"]);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(500);
  });

  it("returns 404 when download URL is missing from result", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: [[]],
          jsonrpc: "2.0",
        });
      }),
    );

    const result = await resolveWorkspaceDownload(["user", "home", "file.txt"]);

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Download URL not found");
  });

  it("returns 404 when result is null", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: null,
          jsonrpc: "2.0",
        });
      }),
    );

    const result = await resolveWorkspaceDownload(["user", "home", "file.txt"]);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 502 when shock download fails", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: [["http://shock/download/abc"]],
          jsonrpc: "2.0",
        });
      }),
      http.get("http://shock/download/abc", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const result = await resolveWorkspaceDownload(["user", "home", "file.txt"]);

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch file content");
  });

  it("decodes filename from last segment", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: [["http://shock/dl"]],
          jsonrpc: "2.0",
        });
      }),
      http.get("http://shock/dl", () => new HttpResponse("ok")),
    );

    const result = await resolveWorkspaceDownload([
      "user",
      "home",
      "my%20file%20(1).fasta",
    ]);

    expect(result).not.toBeInstanceOf(NextResponse);
    const resolved = result as { filename: string };
    expect(resolved.filename).toBe("my file (1).fasta");
  });

  it("uses 'download' as fallback filename for empty segments", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json({
          id: 1,
          result: [["http://shock/dl"]],
          jsonrpc: "2.0",
        });
      }),
      http.get("http://shock/dl", () => new HttpResponse("ok")),
    );

    const result = await resolveWorkspaceDownload([]);

    expect(result).not.toBeInstanceOf(NextResponse);
    const resolved = result as { filename: string };
    expect(resolved.filename).toBe("download");
  });
});
