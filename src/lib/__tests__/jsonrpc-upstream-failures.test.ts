import { http, HttpResponse } from "msw";

import { UpstreamError } from "@/lib/api/upstream-failure";
import { createAppService, submitTimeoutMessage } from "@/lib/app-service";
import { errorResponse } from "@/lib/auth/server/errors";
import { createBvBrcClient, JsonRpcError } from "@/lib/jsonrpc-client";
import { POST as submitRoute } from "@/app/api/services/app-service/submit/route";
import { mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import {
  connectTimeout,
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";

const appServiceUrl = "https://p3.theseed.test/services/app_service";

beforeEach(() => {
  process.env.APP_SERVICE_URL = appServiceUrl;
  process.env.APP_BASE_URL = "https://dxkb.org";
});

afterEach(() => {
  delete process.env.APP_SERVICE_URL;
  delete process.env.APP_BASE_URL;
  vi.restoreAllMocks();
});

function answerAppService(resolver: Parameters<typeof http.post>[1]) {
  server.use(http.post(appServiceUrl, resolver));
}

describe("JsonRpcClient upstream failures", () => {
  it("keeps the connect timeout as the cause and names the job service", async () => {
    answerAppService(() => {
      throw connectTimeout();
    });

    const error = await createBvBrcClient("token")
      .call("AppService.enumerate_tasks_filtered", [0, 10, {}])
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC job service did not respond (connection timed out after 10 s).",
      cause: expect.objectContaining({
        cause: expect.objectContaining({ code: "UND_ERR_CONNECT_TIMEOUT" }) as unknown,
      }) as unknown,
    });
  });

  it("gives up after its budget when the service accepts but never answers", async () => {
    shortenTimeouts();
    answerAppService(neverRespond);

    await expect(
      createBvBrcClient("token").call("AppService.query_task_summary_filtered", [{}]),
    ).rejects.toMatchObject({
      status: 504,
      message: "The BV-BRC job service did not respond (timed out after 30 s).",
    });
  });

  it("summarizes a 503 maintenance page", async () => {
    answerAppService(() => maintenancePage());

    const error = await createBvBrcClient("token")
      .call("AppService.query_task_summary_filtered", [{}])
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `The BV-BRC job service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    });
    expect((error as Error).message).not.toContain("<");
  });

  it("throws the JSON-RPC error a 500 reply carries instead of its status", async () => {
    answerAppService(() =>
      HttpResponse.json(
        {
          id: 1,
          version: "1.1",
          error: { name: "JSONRPCError", code: -32603, message: "_ERROR_Task 9000001 not found_" },
        },
        { status: 500 },
      ),
    );

    const error = await createBvBrcClient("token")
      .call("AppService.kill_task", [9000001])
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(JsonRpcError);
    expect(error).toMatchObject({ code: -32603, message: "_ERROR_Task 9000001 not found_" });
  });
});

describe("AppService.submitService upstream failures", () => {
  const submit = () =>
    createAppService("token").submitService({ app_name: "GenomeAssembly2", app_params: {} });

  it("says a job may still be queued when the job service never answered", async () => {
    shortenTimeouts();
    answerAppService(neverRespond);

    await expect(submit()).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message: submitTimeoutMessage,
    });
    expect(submitTimeoutMessage).toBe(
      "The BV-BRC job service did not respond within 30 s. Your job may still have been queued: check Jobs before you submit it again.",
    );
  });

  it("keeps the connect timeout message, since the job was never sent", async () => {
    answerAppService(() => {
      throw connectTimeout();
    });

    await expect(submit()).rejects.toMatchObject({
      status: 504,
      message:
        "The BV-BRC job service did not respond (connection timed out after 10 s).",
    });
  });
});

describe("submit route", () => {
  it("answers a submit that timed out with 504 and the {error, code} contract", async () => {
    setTestSession();
    shortenTimeouts();
    answerAppService(neverRespond);

    const response = await submitRoute(
      mockNextRequest({
        method: "POST",
        body: { app_name: "GenomeAssembly2", app_params: { output_path: "/u/home" } },
      }),
      {},
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: submitTimeoutMessage,
      code: "upstream",
    });
  });
});

describe("errorResponse", () => {
  it("answers an UpstreamError with its own status", async () => {
    const response = errorResponse(
      new UpstreamError({ status: 503, code: "service_unavailable", message: "down" }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "down", code: "upstream" });
  });

  it("describes a raw undici failure instead of forwarding 'fetch failed'", async () => {
    const response = errorResponse(connectTimeout());
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "An upstream service did not respond (connection timed out after 10 s).",
      code: "upstream",
    });
  });

  it("still forwards an ordinary error's message with the fallback status", async () => {
    const response = errorResponse(new Error("Authentication token not available"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication token not available",
      code: "upstream",
    });
  });
});
