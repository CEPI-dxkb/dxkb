import { http, HttpResponse } from "msw";

import { POST as workspaceProxy } from "@/app/api/services/workspace/route";
import { POST as publicProxy } from "@/app/api/workspace/public/route";
import { GET as previewRoute } from "@/app/api/workspace/preview/[...path]/route";
import { GET as viewRoute } from "@/app/api/workspace/view/[...path]/route";
import {
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  connectTimeout,
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";

const workspaceApiUrl = "https://p3.theseed.test/services/Workspace";
const shockUrl = "https://shock.test/node/abc";

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  setTestSession();
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
  vi.restoreAllMocks();
});

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

function workspaceAnswers(resolver: Parameters<typeof http.post>[1]) {
  server.use(http.post(workspaceApiUrl, resolver));
}

function lsRequest() {
  return mockNextRequest({
    method: "POST",
    body: { method: "Workspace.ls", params: [{ paths: ["/u@bvbrc/home/"] }] },
  });
}

async function body(response: Response): Promise<unknown> {
  return response.json();
}

/** An error reply whose body stalls until the budget ends the read. */
function bodyTimesOut(): HttpResponse<ReadableStream> {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      );
    },
  });
  return new HttpResponse(stream, { status: 503 });
}

const bodyTimedOut = /^The BV-BRC workspace service did not respond \(timed out/;

describe("workspace proxies on an upstream outage", () => {
  describe("POST /api/services/workspace", () => {
    it("answers a connect timeout with 504 and the cause, not 'Internal server error'", async () => {
      workspaceAnswers(() => {
        throw connectTimeout();
      });

      const response = await workspaceProxy(lsRequest(), {});
      expect(response.status).toBe(504);
      await expect(body(response)).resolves.toEqual({ error: timedOut, code: "upstream" });
    });

    it("gives up after its budget when the service never answers", async () => {
      shortenTimeouts();
      workspaceAnswers(neverRespond);

      const response = await workspaceProxy(lsRequest(), {});
      expect(response.status).toBe(504);
      await expect(body(response)).resolves.toEqual({
        error:
          "The BV-BRC workspace service did not respond (timed out after 30 s).",
        code: "upstream",
      });
    });

    it("describes a 503 maintenance page by its status and title, never the HTML", async () => {
      workspaceAnswers(() => maintenancePage());

      const response = await workspaceProxy(lsRequest(), {});
      expect(response.status).toBe(503);
      const text = await response.text();
      const { error } = JSON.parse(text) as { error: string };
      expect(error).toMatch(
        /^The BV-BRC workspace service is unavailable \(HTTP 503 Service Unavailable/,
      );
      expect(error).toContain(maintenanceSummary);
      expect(text).not.toContain("<");
    });

    it("names the host in the server log only, not in what the user reads", async () => {
      const logged = vi.mocked(console.error);
      logged.mockClear();
      workspaceAnswers(() => maintenancePage());

      const response = await workspaceProxy(lsRequest(), {});
      const text = await response.text();

      expect(text).not.toContain("p3.theseed.test");
      expect(logged).toHaveBeenCalledWith(
        "BV-BRC API error from p3.theseed.test:",
        503,
        "Service Unavailable",
        expect.any(String),
      );
    });

    it("forwards the JSON-RPC error a 500 reply carries", async () => {
      workspaceAnswers(() =>
        HttpResponse.json(
          { id: 1, error: { code: -32603, message: "_ERROR_Object not found!_" } },
          { status: 500 },
        ),
      );

      const response = await workspaceProxy(lsRequest(), {});
      expect(response.status).toBe(500);
      await expect(body(response)).resolves.toEqual({
        error: "BV-BRC API error: 500 Internal Server Error",
        apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
      });
    });

    it("answers 504 when an error reply's body times out", async () => {
      workspaceAnswers(() => bodyTimesOut());

      const response = await workspaceProxy(lsRequest(), {});
      expect(response.status).toBe(504);
      const { error } = (await body(response)) as { error: string };
      expect(error).toMatch(bodyTimedOut);
    });
  });

  describe("POST /api/workspace/public", () => {
    it("answers a connect timeout with 504", async () => {
      workspaceAnswers(() => {
        throw connectTimeout();
      });

      const response = await publicProxy(lsRequest());
      expect(response.status).toBe(504);
      await expect(body(response)).resolves.toEqual({ error: timedOut, code: "upstream" });
    });

    it("gives up after its budget", async () => {
      shortenTimeouts();
      workspaceAnswers(neverRespond);

      expect((await publicProxy(lsRequest())).status).toBe(504);
    });

    it("describes a 503 maintenance page by its status and title, never the HTML", async () => {
      workspaceAnswers(() => maintenancePage());

      const response = await publicProxy(lsRequest());
      expect(response.status).toBe(503);
      const text = await response.text();
      const { error } = JSON.parse(text) as { error: string };
      expect(error).toMatch(
        /^The BV-BRC workspace service is unavailable \(HTTP 503 Service Unavailable/,
      );
      expect(error).toContain(maintenanceSummary);
      expect(text).not.toContain("<");
    });

    it("forwards the JSON-RPC error a 500 reply carries", async () => {
      workspaceAnswers(() =>
        HttpResponse.json(
          { id: 1, error: { code: -32603, message: "_ERROR_Object not found!_" } },
          { status: 500 },
        ),
      );

      const response = await publicProxy(lsRequest());
      expect(response.status).toBe(500);
      await expect(body(response)).resolves.toEqual({
        error: "BV-BRC API error: 500 Internal Server Error",
        apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
      });
    });

    it("answers 504 when an error reply's body times out", async () => {
      workspaceAnswers(() => bodyTimesOut());

      const response = await publicProxy(lsRequest());
      expect(response.status).toBe(504);
      const { error } = (await body(response)) as { error: string };
      expect(error).toMatch(bodyTimedOut);
    });
  });

  describe("view and preview", () => {
    const path = ["u@bvbrc", "home", "reads.fq"];
    const viewRequest = () =>
      mockNextRequest({ url: "http://localhost:3019/api/workspace/view/u@bvbrc/home/reads.fq" });
    const previewRequest = () =>
      mockNextRequest({ url: "http://localhost:3019/api/workspace/preview/u@bvbrc/home/reads.fq" });

    function downloadUrlResolves() {
      workspaceAnswers(() => HttpResponse.json({ id: 1, result: [[shockUrl]] }));
    }

    it("view answers a workspace connect timeout with 504", async () => {
      workspaceAnswers(() => {
        throw connectTimeout();
      });

      const response = await viewRoute(viewRequest(), makeRouteContext({ path }));
      expect(response.status).toBe(504);
      await expect(body(response)).resolves.toEqual({ error: timedOut, code: "upstream" });
    });

    it("view gives up when the file store accepts but never answers", async () => {
      shortenTimeouts();
      downloadUrlResolves();
      server.use(http.get(shockUrl, neverRespond));

      const response = await viewRoute(viewRequest(), makeRouteContext({ path }));
      expect(response.status).toBe(504);
      await expect(body(response)).resolves.toEqual({
        error:
          "The BV-BRC file storage service did not respond (timed out after 30 s).",
        code: "upstream",
      });
    });

    it("preview answers a refused file store connection with 502", async () => {
      downloadUrlResolves();
      server.use(
        http.get(shockUrl, () => {
          throw connectionRefused();
        }),
      );

      const response = await previewRoute(previewRequest(), makeRouteContext({ path }));
      expect(response.status).toBe(502);
      await expect(body(response)).resolves.toEqual({
        error: "Could not reach the BV-BRC file storage service: connection refused.",
        code: "upstream",
      });
    });

    it("preview gives up when the workspace never answers", async () => {
      shortenTimeouts();
      workspaceAnswers(neverRespond);

      expect((await previewRoute(previewRequest(), makeRouteContext({ path }))).status).toBe(504);
    });
  });
});
