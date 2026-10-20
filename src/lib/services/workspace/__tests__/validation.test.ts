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

  it("returns false when the Workspace answers that the object is not found", async () => {
    // The proxy's answer to Workspace.get of a missing path.
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json(
          {
            error: "BV-BRC API error: 500 Internal Server Error",
            apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
          },
          { status: 500 },
        ),
      ),
    );

    const result = await checkWorkspaceObjectExists("/user/home/missing.txt");

    expect(result).toBe(false);
  });

  it("returns false for a JSON-RPC not-found error body", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json(
          { error: { code: -32000, message: "Object not found" } },
          { status: 500 },
        ),
      ),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/missing.txt"),
    ).resolves.toBe(false);
  });

  it("returns false when Workspace.get finds nothing", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] }),
      ),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/missing.txt"),
    ).resolves.toBe(false);
  });

  it("rejects on a workspace outage instead of calling the name available", async () => {
    const message =
      "The BV-BRC workspace service did not respond (timed out after 30 s).";
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: message, code: "upstream" }, { status: 504 }),
      ),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/file.txt"),
    ).rejects.toMatchObject({ message, status: 504 });
  });

  it("rejects on any other workspace error", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: "Internal server error" }, { status: 500 }),
      ),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/file.txt"),
    ).rejects.toThrow("Internal server error");
  });

  it("rejects on an empty error response", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/file.txt"),
    ).rejects.toThrow("HTTP error! status: 500");
  });

  it("rejects when fetch fails", async () => {
    server.use(
      http.post("/api/services/workspace", () => {
        return HttpResponse.error();
      }),
    );

    await expect(
      checkWorkspaceObjectExists("/user/home/file.txt"),
    ).rejects.toThrow();
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
