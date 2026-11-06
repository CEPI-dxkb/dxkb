vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  clearTestCookies,
  json,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { copilotName } from "@/lib/copilot/name";

const gatewayUrl = "http://copilot.test/copilot-api";

const gatewayModels = [
  {
    model: "Qwen/Qwen3.6-35B-A3B",
    model_type: "chat",
    active: true,
    priority: 1,
    max_tokens: 32768,
    supports_image: true,
    is_default: true,
  },
  { model: "retired-model", active: false, priority: 9 },
  { model: "gpt-oss-120b", priority: 2 },
];

function gatewaySession(overrides: Record<string, unknown> = {}) {
  return {
    _id: "665f0c",
    session_id: "11111111-2222-3333-4444-555555555555",
    user_id: "testuser@patricbrc.org",
    title: "Genomes of E. coli",
    created_at: "2026-10-29T15:00:00.000Z",
    last_modified: "2026-10-30T09:30:00.000Z",
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ],
    workflow_ids: [],
    execution_mode: "plan",
    ...overrides,
  };
}

async function getModels() {
  const { GET } = await import("../models/route");
  return GET(mockNextRequest({ url: "http://localhost:3019/api/copilot/models" }), {});
}

async function getSessions(searchParams: Record<string, string> = {}) {
  const { GET } = await import("../sessions/route");
  return GET(
    mockNextRequest({
      url: "http://localhost:3019/api/copilot/sessions",
      searchParams,
    }),
    {},
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("COPILOT_API_URL", `${gatewayUrl}/`);
  setTestSession({ token: "un=testuser|tokenid=1|sig=abc" });
});

describe("GET /api/copilot/models", () => {
  it("returns the active models from the gateway's stringified list, sending the bare token", async () => {
    let authorization: string | null = null;
    server.use(
      http.post(`${gatewayUrl}/db/get-model-list`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({
          models: JSON.stringify(gatewayModels),
          vdb_list: "[]",
        });
      }),
    );

    const res = await getModels();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(authorization).toBe("un=testuser|tokenid=1|sig=abc");
    expect(await json(res)).toEqual({
      models: [
        {
          model: "Qwen/Qwen3.6-35B-A3B",
          modelType: "chat",
          priority: 1,
          maxTokens: 32768,
          supportsImage: true,
          isDefault: true,
        },
        {
          model: "gpt-oss-120b",
          modelType: null,
          priority: 2,
          maxTokens: null,
          supportsImage: false,
          isDefault: false,
        },
      ],
    });
  });

  it("lists a model the gateway sends twice once, keeping its first entry", async () => {
    server.use(
      http.post(`${gatewayUrl}/db/get-model-list`, () =>
        HttpResponse.json({
          models: JSON.stringify([
            ...gatewayModels,
            {
              model: "Qwen/Qwen3.6-35B-A3B",
              model_type: "chat",
              active: true,
              priority: 5,
              supports_image: false,
            },
          ]),
          vdb_list: "[]",
        }),
      ),
    );

    const res = await getModels();

    expect(res.status).toBe(200);
    const body = await json<{
      models: { model: string; priority: number | null }[];
    }>(res);
    expect(
      body.models.map(({ model, priority }) => ({ model, priority })),
    ).toEqual([
      { model: "Qwen/Qwen3.6-35B-A3B", priority: 1 },
      { model: "gpt-oss-120b", priority: 2 },
    ]);
  });

  it("answers 401 without calling the gateway when signed out", async () => {
    clearTestCookies();
    const res = await getModels();
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ code: "session_expired" }),
    );
  });

  it("answers 500 naming COPILOT_API_URL only in the server log when it is unset", async () => {
    vi.stubEnv("COPILOT_API_URL", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await getModels();

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body).toEqual({
      error: `${copilotName} is unavailable right now: it is not configured on this server.`,
      code: "unknown",
    });
    expect(JSON.stringify(body)).not.toContain("COPILOT_API_URL");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("COPILOT_API_URL"));
    logged.mockRestore();
  });

  it("answers 502 when the model list is not readable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.post(`${gatewayUrl}/db/get-model-list`, () =>
        HttpResponse.json({ models: "not json", vdb_list: "[]" }),
      ),
    );

    const res = await getModels();

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: "The BV-BRC Copilot service sent an answer DXKB could not read.",
      }),
    );
  });

  it("names the Copilot service when the gateway is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.post(`${gatewayUrl}/db/get-model-list`, () =>
        HttpResponse.text("<html><title>Service Unavailable</title></html>", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const res = await getModels();

    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(
          "The BV-BRC Copilot service is unavailable",
        ) as unknown,
      }),
    );
    expect(JSON.stringify(body)).not.toContain("<html>");
  });
});

describe("GET /api/copilot/sessions", () => {
  it("returns session summaries without their messages", async () => {
    let query: URLSearchParams | null = null;
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-all-sessions`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          sessions: [
            gatewaySession(),
            gatewaySession({
              session_id: "busy",
              title: "",
              created_at: { $date: 1 },
              last_modified: null,
              messages: undefined,
              execution_mode: "execute",
              active_job_id: "job-1",
            }),
          ],
          total: 41,
          has_more: true,
        });
      }),
    );

    const res = await getSessions({ limit: "2", offset: "20" });

    expect(res.status).toBe(200);
    expect(query).toEqual(new URLSearchParams({ limit: "2", offset: "20" }));
    const body = await json(res);
    expect(body).toEqual({
      sessions: [
        {
          sessionId: "11111111-2222-3333-4444-555555555555",
          title: "Genomes of E. coli",
          createdAt: "2026-10-29T15:00:00.000Z",
          lastModified: "2026-10-30T09:30:00.000Z",
          messageCount: 2,
          executionMode: "plan",
          activeJobId: null,
        },
        {
          sessionId: "busy",
          title: "New Chat",
          createdAt: null,
          lastModified: null,
          messageCount: 0,
          executionMode: "execute",
          activeJobId: "job-1",
        },
      ],
      total: 41,
      hasMore: true,
    });
    expect(JSON.stringify(body)).not.toContain("hello");
  });

  it.each([
    [{}, { limit: "20", offset: "0" }],
    [{ limit: "500", offset: "-3" }, { limit: "100", offset: "0" }],
    [{ limit: "0", offset: "abc" }, { limit: "1", offset: "0" }],
  ])("clamps paging %o to %o", async (given, sent) => {
    let query: URLSearchParams | null = null;
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-all-sessions`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ sessions: [], total: 0, has_more: false });
      }),
    );

    const res = await getSessions(given);

    expect(res.status).toBe(200);
    expect(query).toEqual(new URLSearchParams(sent));
  });

  it("forwards an offset beyond the safe integer range as the largest safe integer", async () => {
    let query: URLSearchParams | null = null;
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-all-sessions`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ sessions: [], total: 0, has_more: false });
      }),
    );

    const res = await getSessions({ offset: "99999999999999999999999" });

    expect(res.status).toBe(200);
    expect(query).toEqual(
      new URLSearchParams({ limit: "20", offset: "9007199254740991" }),
    );
  });

  it("keeps the gateway's rejection status and message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-all-sessions`, () =>
        HttpResponse.json({ message: "Invalid token" }, { status: 401 }),
      ),
    );

    const res = await getSessions();

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Invalid token") as unknown,
      }),
    );
  });
});
