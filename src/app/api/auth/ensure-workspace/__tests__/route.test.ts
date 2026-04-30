import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

const workspaceApiUrl = "https://workspace.test/Workspace";
const userUrl = "https://user.test/user";

interface JsonRpcRequest {
  method: string;
  params: unknown[];
}

function setSessionCookies({
  token,
  userId,
  realm,
}: {
  token: string;
  userId: string;
  realm?: string;
}) {
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === "bvbrc_token") return { value: token };
    if (name === "bvbrc_user_id") return { value: userId };
    if (name === "bvbrc_realm") return realm ? { value: realm } : undefined;
    return undefined;
  });
}

function clearSessionCookies() {
  mockCookieStore.get.mockReturnValue(undefined);
}

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  process.env.USER_URL = userUrl;
  process.env.DEFAULT_REALM = "bvbrc";
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
  delete process.env.USER_URL;
  delete process.env.DEFAULT_REALM;
});

describe("POST /api/auth/ensure-workspace", () => {
  it("returns 401 when there is no session", async () => {
    clearSessionCookies();
    const response = await POST(mockNextRequest({ method: "POST" }), {});
    expect(response.status).toBe(401);
  });

  it("calls Workspace.ls then creates home + sub-folders for a fresh user", async () => {
    setSessionCookies({ token: "tok", userId: "alice", realm: "bvbrc" });

    const calls: JsonRpcRequest[] = [];
    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        const body = (await request.json()) as JsonRpcRequest;
        calls.push(body);
        if (body.method === "Workspace.ls") {
          return HttpResponse.json(
            { id: 1, jsonrpc: "2.0", error: { message: "_ERROR_User lacks permission", code: -32603 } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
      }),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(calls.map((c) => c.method)).toEqual([
      "Workspace.ls",
      "Workspace.create",
      "Workspace.create",
    ]);
    expect(data.created).toEqual(
      expect.arrayContaining([
        "/alice@bvbrc/home/",
        "/alice@bvbrc/home/Genome Groups",
        "/alice@bvbrc/home/Feature Groups",
        "/alice@bvbrc/home/Experiments",
        "/alice@bvbrc/home/Experiment Groups",
      ]),
    );
    expect(data.failures).toEqual({});
  });

  it("forwards the session token in the Authorization header", async () => {
    setSessionCookies({ token: "alice-token", userId: "alice", realm: "bvbrc" });

    let capturedAuth: string | null = null;
    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        const body = (await request.json()) as JsonRpcRequest;
        if (body.method === "Workspace.ls") {
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
            result: [{ "/alice@bvbrc/home/": [] }],
          });
        }
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
      }),
    );

    await POST(mockNextRequest({ method: "POST" }), {});
    expect(capturedAuth).toBe("alice-token");
  });

  it("returns success with failures when the sub-folder batch fails", async () => {
    setSessionCookies({ token: "tok", userId: "alice", realm: "bvbrc" });

    let createCallCount = 0;
    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        const body = (await request.json()) as JsonRpcRequest;
        if (body.method === "Workspace.ls") {
          return HttpResponse.json(
            { id: 1, jsonrpc: "2.0", error: { message: "_ERROR_User lacks permission" } },
            { status: 500 },
          );
        }
        createCallCount += 1;
        if (createCallCount === 2) {
          return HttpResponse.json(
            { id: 1, jsonrpc: "2.0", error: { message: "Sub-folder batch upstream failure" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
      }),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.created).toEqual(["/alice@bvbrc/home/"]);
    expect(Object.values(data.failures)).toContain(
      "Sub-folder batch upstream failure",
    );
  });

  it("falls back to DEFAULT_REALM when the session has no realm", async () => {
    setSessionCookies({ token: "tok", userId: "alice" });
    process.env.DEFAULT_REALM = "dxkb";

    const lsParams: { paths?: string[] } = {};
    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        const body = (await request.json()) as JsonRpcRequest;
        if (body.method === "Workspace.ls") {
          const param = body.params[0] as { paths: string[] };
          lsParams.paths = param.paths;
        }
        return HttpResponse.json({
          id: 1,
          jsonrpc: "2.0",
          result: [
            {
              "/alice@dxkb/home/": [
                ["Genome Groups", "folder", "/alice@dxkb/home/"],
                ["Feature Groups", "folder", "/alice@dxkb/home/"],
                ["Experiments", "folder", "/alice@dxkb/home/"],
                ["Experiment Groups", "folder", "/alice@dxkb/home/"],
              ],
            },
          ],
        });
      }),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});
    expect(response.status).toBe(200);
    expect(lsParams.paths).toEqual(["/alice@dxkb/home/"]);
  });
});
