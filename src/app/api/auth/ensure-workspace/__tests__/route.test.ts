const mocks = vi.hoisted(() => ({
  ensureUserWorkspace: vi.fn(),
  createServerWorkspaceRpc: vi.fn(() => "rpc"),
  getDefaultRealm: vi.fn(() => "bvbrc"),
}));

vi.mock("@/lib/services/workspace/setup", () => ({
  ensureUserWorkspace: mocks.ensureUserWorkspace,
}));
vi.mock("@/lib/services/workspace/server-rpc", () => ({
  createServerWorkspaceRpc: mocks.createServerWorkspaceRpc,
}));
vi.mock("@/lib/services/workspace/realm", () => ({
  getDefaultRealm: mocks.getDefaultRealm,
}));

import {
  clearTestCookies,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  clearTestCookies();
});

describe("POST /api/auth/ensure-workspace", () => {
  it("returns 401 when there is no session", async () => {
    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(401);
    expect(mocks.ensureUserWorkspace).not.toHaveBeenCalled();
  });

  it("passes the authenticated identity and serializes the workspace result", async () => {
    setTestSession({ token: "token", userId: "alice" });
    mocks.ensureUserWorkspace.mockResolvedValue({
      created: ["/alice@bvbrc/home/"],
      failures: {},
    });

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(mocks.createServerWorkspaceRpc).toHaveBeenCalledWith("token");
    expect(mocks.ensureUserWorkspace).toHaveBeenCalledWith({
      rpc: "rpc",
      userId: "alice",
      realm: "bvbrc",
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      created: ["/alice@bvbrc/home/"],
      failures: {},
    });
  });

  it("reports folders it could not create as a 502, never as success", async () => {
    setTestSession({ token: "token", userId: "alice" });
    mocks.ensureUserWorkspace.mockResolvedValue({
      created: ["/alice@bvbrc/home/"],
      failures: {
        "/alice@bvbrc/home/Genome Groups": "_ERROR_Quota exceeded_ERROR_",
        "/alice@bvbrc/home/Experiments": "_ERROR_Quota exceeded_ERROR_",
      },
    });

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(502);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      error:
        "Couldn't create /alice@bvbrc/home/Genome Groups (and 1 more): _ERROR_Quota exceeded_ERROR_",
      code: "upstream",
      created: ["/alice@bvbrc/home/"],
    });
    expect(body).not.toHaveProperty("success");
  });
});

