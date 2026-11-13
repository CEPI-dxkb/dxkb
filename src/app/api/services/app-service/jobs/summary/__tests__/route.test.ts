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
  taskSummary: unknown;
  appSummary: unknown;
  /** Fresh `enumerate_tasks_filtered` totals by status; a missing status counts 0. */
  counts?: Record<string, number>;
}

/** Answers both cached summaries and the per-status count calls the route makes; records every call. */
function answerAppService({ taskSummary, appSummary, counts = {} }: AppServiceAnswers) {
  const calls: RpcBody[] = [];
  server.use(
    http.post(appServiceUrl, async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      calls.push(body);
      const answer = (result: unknown) =>
        HttpResponse.json({ id: body.id, jsonrpc: "2.0", result });
      switch (body.method) {
        case "AppService.query_task_summary_filtered":
          return answer(taskSummary);
        case "AppService.query_app_summary_filtered":
          return answer(appSummary);
        case "AppService.enumerate_tasks_filtered": {
          const status = (body.params[2] as { status?: string }).status ?? "";
          return answer([[], counts[status] ?? 0]);
        }
        default:
          return HttpResponse.json({ error: `unexpected ${body.method}` }, { status: 400 });
      }
    }),
  );
  return calls;
}

async function postSummary(body: Record<string, unknown> = {}) {
  const response = await POST(mockNextRequest({ method: "POST", body }), {});
  return {
    response,
    data: (await response.json()) as {
      taskSummary?: Record<string, number>;
      appSummary?: unknown;
      error?: string;
    },
  };
}

describe("POST /api/services/app-service/jobs/summary", () => {
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

  it("counts a queued job the backend's cached task summary does not show yet", async () => {
    answerAppService({
      taskSummary: [{ "in-progress": 1 }],
      appSummary: [{ GenomeAssembly2: 1 }],
      counts: { queued: 1 },
    });

    const { response, data } = await postSummary();

    expect(response.status).toBe(200);
    expect(data.taskSummary).toEqual(expect.objectContaining({ queued: 1 }));
  });

  it("overlays the fresh counts on the task summary and passes the app summary through", async () => {
    const appSummary = [{ GenomeAssembly2: 5, BLAST: 7 }];
    answerAppService({
      taskSummary: [{ completed: 10, deleted: 2 }],
      appSummary,
      counts: { queued: 2, completed: 10 },
    });

    const { data } = await postSummary();

    expect(data).toEqual({
      taskSummary: {
        queued: 2,
        pending: 0,
        "in-progress": 0,
        completed: 10,
        failed: 0,
        deleted: 2,
      },
      appSummary,
    });
  });

  it.each([
    [true, { include_archived: 1 }],
    [false, {}],
  ])("sends include_archived=%s to every call", async (includeArchived, opts) => {
    const calls = answerAppService({ taskSummary: [{}], appSummary: [{}] });

    await postSummary({ include_archived: includeArchived });

    expect(calls).toHaveLength(7);
    for (const call of calls) {
      expect(call.params.at(-1)).toEqual(expect.objectContaining(opts));
      if (!includeArchived) {
        expect(call.params.at(-1)).not.toHaveProperty("include_archived");
      }
    }
  });

  it("answers the backend's error message when the cached task summary call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.post(appServiceUrl, async ({ request }) => {
        const body = (await request.json()) as RpcBody;
        if (body.method === "AppService.query_task_summary_filtered") {
          return HttpResponse.json(
            { id: body.id, jsonrpc: "2.0", error: { code: -32603, message: "DB connection lost" } },
            { status: 500 },
          );
        }
        const result = body.method === "AppService.enumerate_tasks_filtered" ? [[], 0] : [{}];
        return HttpResponse.json({ id: body.id, jsonrpc: "2.0", result });
      }),
    );

    const { response, data } = await postSummary();

    expect(response.status).toBe(500);
    expect(data).toEqual(
      expect.objectContaining({ error: "DB connection lost" }),
    );
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
