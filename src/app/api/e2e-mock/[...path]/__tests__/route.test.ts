import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { DELETE, GET, POST, PUT } from "../route";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

function ctx(path: string[]): RouteContext {
  return { params: Promise.resolve({ path }) };
}

const originalMockEnabled = process.env.E2E_MOCK_ENABLED;

afterEach(() => {
  if (originalMockEnabled === undefined) {
    delete process.env.E2E_MOCK_ENABLED;
  } else {
    process.env.E2E_MOCK_ENABLED = originalMockEnabled;
  }
});

describe("api/e2e-mock catch-all — guard", () => {
  it.each(["0", "", "true", "false"])(
    "returns 404 when E2E_MOCK_ENABLED is %p (anything other than '1')",
    async (flag) => {
      process.env.E2E_MOCK_ENABLED = flag;

      const getResp = await GET(
        mockNextRequest({ url: "http://localhost:3020/api/e2e-mock/foo" }),
        ctx(["foo"]),
      );
      expect(getResp.status).toBe(404);
      expect(await getResp.json()).toEqual({ error: "Mock endpoint disabled" });

      const postResp = await POST(
        mockNextRequest({ method: "POST", body: { method: "x" }, url: "http://localhost:3020/api/e2e-mock/foo" }),
        ctx(["foo"]),
      );
      expect(postResp.status).toBe(404);
    },
  );

  it("returns 404 when E2E_MOCK_ENABLED is unset", async () => {
    delete process.env.E2E_MOCK_ENABLED;

    const resp = await GET(
      mockNextRequest({ url: "http://localhost:3020/api/e2e-mock/anything" }),
      ctx(["anything"]),
    );
    expect(resp.status).toBe(404);
  });
});

describe("api/e2e-mock catch-all — enabled", () => {
  beforeEach(() => {
    process.env.E2E_MOCK_ENABLED = "1";
  });

  it("GET returns 200 with empty object", async () => {
    const resp = await GET(
      mockNextRequest({ url: "http://localhost:3020/api/e2e-mock/app-service/foo" }),
      ctx(["app-service", "foo"]),
    );

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({});
  });

  it("POST returns 200 with JSON-RPC-shaped empty result", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        body: { id: 1, jsonrpc: "2.0", method: "Workspace.ls", params: [] },
        url: "http://localhost:3020/api/e2e-mock/workspace",
      }),
      ctx(["workspace"]),
    );

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ id: 1, jsonrpc: "2.0", result: [[]] });
  });

  it("POST handles non-JSON bodies without throwing", async () => {
    const request = new Request("http://localhost:3020/api/e2e-mock/upload", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "raw text",
    });

    const resp = await POST(request as unknown as Parameters<typeof POST>[0], ctx(["upload"]));

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ id: 1, jsonrpc: "2.0", result: [[]] });
  });

  it("PUT returns 200 with empty object", async () => {
    const resp = await PUT(
      mockNextRequest({ method: "PUT", body: {}, url: "http://localhost:3020/api/e2e-mock/foo" }),
      ctx(["foo"]),
    );

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({});
  });

  it("DELETE returns 200 with empty object", async () => {
    const resp = await DELETE(
      mockNextRequest({ method: "DELETE", url: "http://localhost:3020/api/e2e-mock/foo/bar" }),
      ctx(["foo", "bar"]),
    );

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({});
  });
});
