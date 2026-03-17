import { http, HttpResponse } from "msw";

import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";
import { server } from "@/test-helpers/msw-server";

describe("checkWorkspaceObjectExists", () => {
  it("returns true when response.ok", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const result = await checkWorkspaceObjectExists("/user/home/file.txt");

    expect(result).toBe(true);
  });

  it("returns false when response is not ok", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const result = await checkWorkspaceObjectExists("/user/home/missing.txt");

    expect(result).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return HttpResponse.error();
      }),
    );

    const result = await checkWorkspaceObjectExists("/user/home/file.txt");

    expect(result).toBe(false);
  });

  it("returns false for empty path", async () => {
    const result = await checkWorkspaceObjectExists("");

    expect(result).toBe(false);
  });

  it("returns false for whitespace-only path", async () => {
    const result = await checkWorkspaceObjectExists("   ");

    expect(result).toBe(false);
  });

  it("passes AbortSignal to fetch", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const controller = new AbortController();

    const result = await checkWorkspaceObjectExists("/user/home/file.txt", {
      signal: controller.signal,
    });

    expect(result).toBe(true);
  });

  it("sends Workspace.get request with the full path", async () => {
    let capturedBody: unknown;

    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await checkWorkspaceObjectExists("/user/home/my-file.txt");

    expect(capturedBody).toEqual({
      method: "Workspace.get",
      params: [{ objects: ["/user/home/my-file.txt"], metadata_only: true }],
    });
  });
});
