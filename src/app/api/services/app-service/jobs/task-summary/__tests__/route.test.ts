import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { clearTestCookies, mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { maintenancePage } from "@/test-helpers/upstream-failures";
import { POST } from "../route";

const appServiceUrl = "https://p3.theseed.test/services/app_service";

interface RpcBody {
  id: number;
  method: string;
  params: unknown[];
}

interface AppServiceAnswers {
  /** The cached `query_task_summary_filtered` result. */
  summary: unknown;
  /** Fresh `enumerate_tasks_filtered` totals by status; a missing status counts 0. */
  counts?: Record<string, number>;
  /** Statuses whose count call answers a JSON-RPC error. */
  failingStatuses?: string[];
}

/** Answers the cached summary and the per-status count calls the route makes; records every call. */
function answerAppService({ summary, counts = {}, failingStatuses = [] }: AppServiceAnswers) {
  const calls: RpcBody[] = [];
  server.use(
    http.post(appServiceUrl, async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      calls.push(body);
      if (body.method === "AppService.query_task_summary_filtered") {
        return HttpResponse.json({ id: body.id, jsonrpc: "2.0", result: summary });
      }
      if (body.method === "AppService.enumerate_tasks_filtered") {
        const status = (body.params[2] as { status?: string }).status ?? "";
        if (failingStatuses.includes(status)) {
          return HttpResponse.json(
            { id: body.id, jsonrpc: "2.0", error: { code: -32603, message: `count ${status} failed` } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ id: body.id, jsonrpc: "2.0", result: [[], counts[status] ?? 0] });
      }
      return HttpResponse.json({ error: `unexpected ${body.method}` }, { status: 400 });
    }),
  );
  return calls;
}

async function postSummary(body: Record<string, unknown> = {}) {
  const response = await POST(mockNextRequest({ method: "POST", body }), {});
  return { response, data: (await response.json()) as { summary?: Record<string, number>; error?: string } };
}

describe("POST /api/services/app-service/jobs/task-summary", () => {
  beforeEach(() => {
    process.env.APP_SERVICE_URL = appServiceUrl;
    setTestSession();
  });

  afterEach(() => {
    delete process.env.APP_SERVICE_URL;
    vi.restoreAllMocks();
  });

  it("returns 401 when no auth token is available", async () => {
    clearTestCookies();

    const { response, data } = await postSummary();

    expect(response.status).toBe(401);
    expect(data).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("counts a queued job the backend's cached summary does not show yet", async () => {
    answerAppService({ summary: [{ "in-progress": 1 }], counts: { queued: 1 } });

    const { response, data } = await postSummary();

    expect(response.status).toBe(200);
    expect(data.summary).toEqual(expect.objectContaining({ queued: 1 }));
  });

  it("overlays every fresh status count on the cached summary and keeps the other keys", async () => {
    answerAppService({
      summary: [{ "in-progress": 3, completed: 247, failed: 85, deleted: 4 }],
      counts: { queued: 2, "in-progress": 1, completed: 249, failed: 85 },
    });

    const { data } = await postSummary();

    expect(data.summary).toEqual({
      queued: 2,
      pending: 0,
      "in-progress": 1,
      completed: 249,
      failed: 85,
      deleted: 4,
    });
  });

  it("sets a status the fresh count finds empty to 0, over a stale cached count", async () => {
    answerAppService({ summary: { queued: 1 }, counts: {} });

    const { data } = await postSummary();

    expect(data.summary).toEqual(expect.objectContaining({ queued: 0 }));
  });

  it("keeps the cached count for a status whose count call fails, and logs it once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    answerAppService({
      summary: [{ queued: 4, completed: 10 }],
      counts: { completed: 11 },
      failingStatuses: ["queued", "pending"],
    });

    const { response, data } = await postSummary();

    expect(response.status).toBe(200);
    expect(data.summary).toEqual({
      queued: 4,
      "in-progress": 0,
      completed: 11,
      failed: 0,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("queued: count queued failed"),
    );
  });

  it("counts each fresh status with include_archived and no search term", async () => {
    const calls = answerAppService({ summary: [{}] });

    await postSummary({ include_archived: true });

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "AppService.query_task_summary_filtered",
        params: [{ include_archived: 1 }],
      }),
    );
    const countCalls = calls.filter(
      (call) => call.method === "AppService.enumerate_tasks_filtered",
    );
    expect(countCalls.map((call) => call.params)).toEqual(
      ["queued", "pending", "in-progress", "completed", "failed"].map(
        (status) => [0, 1, { include_archived: 1, status }],
      ),
    );
  });

  it("answers the backend's error message when the cached summary call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    server.use(
      http.post(appServiceUrl, async ({ request }) => {
        const body = (await request.json()) as RpcBody;
        if (body.method === "AppService.query_task_summary_filtered") {
          return HttpResponse.json(
            { id: body.id, jsonrpc: "2.0", error: { code: -32603, message: "Service down" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ id: body.id, jsonrpc: "2.0", result: [[], 0] });
      }),
    );

    const { response, data } = await postSummary();

    expect(response.status).toBe(500);
    expect(data).toEqual(expect.objectContaining({ error: "Service down" }));
  });

  it("answers an outage of the job service as 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    server.use(http.post(appServiceUrl, () => maintenancePage()));

    const { response, data } = await postSummary();

    expect(response.status).toBe(503);
    expect(data.error).toContain("BV-BRC job service");
  });
});
