import { http, HttpResponse } from "msw";
import { POST } from "@/app/api/auth/ensure-workspace/route";
import { mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { connectTimeout, maintenancePage } from "@/test-helpers/upstream-failures";

const workspaceApiUrl = "https://p3.theseed.test/services/Workspace";
const homePath = "/alice@bvbrc/home/";

interface RpcBody {
  method: string;
}

/** Records each JSON-RPC method that reaches the Workspace. */
function workspaceAnswers(answer: (method: string) => Response | never): string[] {
  const methods: string[] = [];
  server.use(
    http.post(workspaceApiUrl, async ({ request }) => {
      const { method } = (await request.json()) as RpcBody;
      methods.push(method);
      return answer(method);
    }),
  );
  return methods;
}

const rpcResult = (result: unknown) => HttpResponse.json({ id: 1, jsonrpc: "2.0", result });
const rpcError = (message: string) =>
  HttpResponse.json(
    { id: 1, jsonrpc: "2.0", error: { code: -32603, message } },
    { status: 500 },
  );
const homeMissing = () =>
  rpcError(`_ERROR_User lacks permission to ${homePath}_ERROR_`);

/**
 * Headers, then a body cut short by the budget. MSW does not tie the request
 * signal to a mocked body, so the stream errors the way undici's does when
 * `AbortSignal.timeout` fires mid-body.
 */
function stalledBody(status: number): HttpResponse<ReadableStream> {
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"id":'));
        controller.error(
          new DOMException("The operation was aborted due to timeout", "TimeoutError"),
        );
      },
    }),
    { status },
  );
}

const timedOut =
  "The BV-BRC workspace service did not respond (timed out after 30 s).";

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  setTestSession({ token: "token", userId: "alice", realm: "bvbrc" });
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
});

describe("POST /api/auth/ensure-workspace against the Workspace", () => {
  it("answers an outage with 504 and the cause, and writes nothing", async () => {
    const methods = workspaceAnswers(() => {
      throw connectTimeout();
    });

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error:
        "The BV-BRC workspace service did not respond (connection timed out after 10 s).",
      code: "upstream",
    });
    expect(methods).toEqual(["Workspace.ls"]);
  });

  it("answers a maintenance page with its 503 and page title, and writes nothing", async () => {
    const methods = workspaceAnswers(() => maintenancePage());

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(
      /^The BV-BRC workspace service .*is unavailable \(HTTP 503/,
    );
    expect(body.error).not.toMatch(/<[a-z!]/i);
    expect(methods).toEqual(["Workspace.ls"]);
  });

  it("answers a reply that times out mid-body with 504, and stops writing", async () => {
    const methods = workspaceAnswers((method) =>
      method === "Workspace.ls" ? homeMissing() : stalledBody(200),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: timedOut,
      code: "upstream",
    });
    expect(methods).toEqual(["Workspace.ls", "Workspace.create"]);
  });

  it("answers an error body that times out with 504, not the bare HTTP 500", async () => {
    const methods = workspaceAnswers(() => stalledBody(500));

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: timedOut,
      code: "upstream",
    });
    expect(methods).toEqual(["Workspace.ls"]);
  });

  it("treats a JSON-RPC error inside a 503 as an outage, and stops writing", async () => {
    const methods = workspaceAnswers((method) =>
      method === "Workspace.ls"
        ? homeMissing()
        : HttpResponse.json(
            {
              id: 1,
              jsonrpc: "2.0",
              error: { code: -32603, message: "Service temporarily unavailable" },
            },
            { status: 503, statusText: "Service Unavailable" },
          ),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(
      /^The BV-BRC workspace service is unavailable \(HTTP 503 Service Unavailable: Service temporarily unavailable/,
    );
    expect(methods).toEqual(["Workspace.ls", "Workspace.create"]);
  });

  it("creates the home and its folders when the Workspace says the home is missing", async () => {
    const methods = workspaceAnswers((method) =>
      method === "Workspace.ls" ? homeMissing() : rpcResult([[]]),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      failures: {},
    });
    expect(methods).toEqual(["Workspace.ls", "Workspace.create", "Workspace.create"]);
  });

  it("answers 200 with nothing created when the home is complete", async () => {
    workspaceAnswers(() =>
      rpcResult([
        {
          [homePath]: ["Genome Groups", "Feature Groups", "Experiments", "Experiment Groups"].map(
            (name) => [name, "folder", homePath],
          ),
        },
      ]),
    );

    const response = await POST(mockNextRequest({ method: "POST" }), {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      created: [],
      failures: {},
    });
  });
});
