vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import {
  maxCopilotAttachments,
  maxCopilotFileBytes,
} from "@/lib/copilot/attachments";
import { server } from "@/test-helpers/msw-server";
import {
  json,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

const gatewayUrl = "http://copilot.test/copilot-api";
const sessionId = "11111111-2222-3333-4444-555555555555";
const token = "un=testuser|tokenid=1|sig=abc";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("COPILOT_API_URL", gatewayUrl);
  setTestSession({ token });
});

function sse(...frames: string[]) {
  return new HttpResponse(frames.join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function postChat(body: unknown) {
  const { POST } = await import("../chat/route");
  return POST(
    mockNextRequest({
      method: "POST",
      url: "http://localhost:3019/api/copilot/chat",
      body,
    }),
    {},
  );
}

describe("POST /api/copilot/chat", () => {
  it("streams the gateway's events through, sending only whitelisted fields", async () => {
    let sent: Record<string, unknown> | null = null;
    let authorization: string | null = null;
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        authorization = request.headers.get("authorization");
        return sse(
          ": connected\n\n",
          'event: started\ndata: {"job_id":"j1"}\n\n',
          'event: final_response\ndata: {"chunk":"Hi"}\n\n',
          'event: done\ndata: {"job_id":"j1"}\n\n',
        );
      }),
    );

    const res = await postChat({
      sessionId,
      query: "  Find Mpox genomes ",
      model: "Qwen/Qwen3.6-35B-A3B",
      pageContext: "The user is on DXKB.",
      user_id: "someone-else",
      execution_mode: "execute",
      auth_token: "forged",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(await res.text()).toContain('event: final_response\ndata: {"chunk":"Hi"}');
    expect(authorization).toBe(token);
    expect(sent).toEqual({
      query: "Find Mpox genomes",
      model: "Qwen/Qwen3.6-35B-A3B",
      session_id: sessionId,
      system_prompt: "The user is on DXKB.",
      save_chat: true,
      include_history: true,
      stream: true,
      execution_mode: "plan",
    });
  });

  it("sends clarification answers, replays, and revisions in the gateway's shape", async () => {
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return sse('event: done\ndata: {}\n\n');
      }),
    );
    const actions = [{ tool: "submit_gowe_job", summary: "Assemble", arguments: { app: "A" } }];

    await postChat({
      sessionId,
      query: "Find genomes",
      model: "m",
      executionMode: "execute",
      targetAgent: "planning",
      clarification: {
        answers: [
          { question: "Which host?", answer: "Human" },
          { question: "Since?", answer: "2022" },
        ],
        originalQuery: "Find genomes",
      },
    });
    await postChat({ sessionId, query: "Run it", model: "m", targetAgent: "service", replayActions: actions });
    await postChat({ sessionId, query: "drop it", model: "m", targetAgent: "service", preparedActions: actions });

    expect(sent[0]).toEqual(
      expect.objectContaining({
        execution_mode: "execute",
        target_agent: "planning",
        workflow_context: {
          plan_action: "answer_questions",
          clarification_answers: [
            { question: "Which host?", answer: "Human" },
            { question: "Since?", answer: "2022" },
          ],
          clarification_summary: "Which host?: Human\nSince?: 2022",
          original_query: "Find genomes",
        },
      }),
    );
    expect(sent[1]).toEqual(
      expect.objectContaining({ execute_once: true, replay_actions: actions, target_agent: "service" }),
    );
    expect(sent[1]).not.toHaveProperty("prepared_actions");
    expect(sent[2]).toEqual(expect.objectContaining({ prepared_actions: actions }));
    expect(sent[2]).not.toHaveProperty("execute_once");
  });

  it.each([
    [{ sessionId, query: "q", model: "m", replayActions: [{ tool: "t" }], preparedActions: [{ tool: "t" }] }],
    [{ sessionId, query: "q", model: "m", targetAgent: "Service Agent" }],
    [{ sessionId, query: "q", model: "m", executionMode: "always" }],
    [{ sessionId, query: "q", model: "m", replayActions: [] }],
    [{ sessionId, query: "", model: "m" }],
    [{ sessionId: "../etc", query: "q", model: "m" }],
    [{ sessionId, query: "q" }],
    [{ sessionId, query: "q", model: "m", pageContext: "x".repeat(3000) }],
  ])("answers 400 for an invalid request %#", async (body) => {
    const res = await postChat(body);
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(expect.objectContaining({ code: "validation" }));
  });

  it("forwards a turn already running in the session as 409 TURN_IN_FLIGHT", async () => {
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, () =>
        HttpResponse.json(
          { code: "TURN_IN_FLIGHT", message: "A response is already being generated in this chat." },
          { status: 409 },
        ),
      ),
    );

    const res = await postChat({ sessionId, query: "q", model: "m" });

    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({
      error: "A response is already being generated in this chat.",
      code: "validation",
      copilotCode: "TURN_IN_FLIGHT",
    });
  });

  it("answers the gateway's busy 429 with its own message", async () => {
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, () =>
        HttpResponse.json({ error: "The system is busy. Please try again shortly." }, { status: 429 }),
      ),
    );

    const res = await postChat({ sessionId, query: "q", model: "m" });

    expect(res.status).toBe(429);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "The system is busy. Please try again shortly." }),
    );
  });
});

describe("POST /api/copilot/chat plan steps and attachments", () => {
  const plan = {
    plan_id: "p1",
    title: "Find and annotate",
    status: "executing",
    steps: [
      { step_id: "step_1", description: "Find genomes", agent: "data", reasoning: "r" },
      { step_id: "step_2", description: "Annotate", agent: "service", reasoning: "r" },
    ],
  };

  it("sends a plan step as execute_next, and attachments in the gateway's fields", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sse('event: done\ndata: {}\n\n');
      }),
    );

    const step = await postChat({
      sessionId,
      query: "Execute plan step: Annotate",
      model: "m",
      targetAgent: "planning",
      planStep: { plan, stepIndex: 1 },
    });
    expect(step.status).toBe(200);
    await step.text();

    const attached = await postChat({
      sessionId,
      query: "What is in these?",
      model: "vision",
      images: [{ name: "gel.png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }],
      files: [{ name: "ids.txt", content: "a\nb", mimeType: "text/plain", size: 3 }],
      pdfs: [{ name: "paper.pdf", dataUrl: "data:application/pdf;base64,JVBERi0xLjQK", size: 9 }],
    });
    expect(attached.status).toBe(200);
    await attached.text();

    expect(bodies[0]).toEqual(
      expect.objectContaining({
        target_agent: "planning",
        workflow_context: {
          plan,
          plan_action: "execute_next",
          current_step_index: 1,
          completed_step_results: {},
        },
      }),
    );
    expect(bodies[1]).toEqual(
      expect.objectContaining({
        model: "vision",
        images: ["data:image/png;base64,iVBORw0KGgo="],
        image_attachments: [{ type: "image", source: "upload", name: "gel.png" }],
        files: [{ name: "ids.txt", content: "a\nb", mime_type: "text/plain", size: 3 }],
        pdfs: [
          {
            name: "paper.pdf",
            content: "data:application/pdf;base64,JVBERi0xLjQK",
            mime_type: "application/pdf",
            size: 9,
          },
        ],
      }),
    );
  });

  it("refuses binary text files, non-PDFs, and more than three attachments", async () => {
    const image = { name: "a.png", dataUrl: "data:image/png;base64,AAAA" };
    const cases = [
      { files: [{ name: "x.bin", content: "a\u0000b", mimeType: "text/plain", size: 3 }] },
      { pdfs: [{ name: "x.pdf", dataUrl: "data:application/pdf;base64,AAAA", size: 3 }] },
      { images: [image, image, image, image] },
      { images: [image, image], files: [{ name: "t", content: "t", mimeType: "text/plain", size: 1 }, { name: "u", content: "u", mimeType: "text/plain", size: 1 }] },
      { planStep: { plan: { ...plan, plan_id: "bad id!" }, stepIndex: 0 } },
    ];
    for (const extra of cases) {
      const res = await postChat({ sessionId, query: "q", model: "m", ...extra });
      expect(res.status).toBe(400);
    }
  });
});

describe("POST /api/copilot/chat body and stream guards", () => {
  const maxBytes = maxCopilotAttachments * 2 * maxCopilotFileBytes + 2 * 1024 * 1024;

  function neverCalled() {
    const calls: string[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/copilot-agent`, () => {
        calls.push("called");
        return sse('event: done\ndata: {}\n\n');
      }),
    );
    return calls;
  }

  it("answers 413 for a declared Content-Length over the cap", async () => {
    const calls = neverCalled();
    const { POST } = await import("../chat/route");
    const request = mockNextRequest({
      method: "POST",
      url: "http://localhost:3019/api/copilot/chat",
      body: { sessionId, query: "q", model: "m" },
      headers: { "Content-Length": String(maxBytes + 1) },
    });
    const res = await POST(request, {});
    expect(res.status).toBe(413);
    expect(await json(res)).toEqual(
      expect.objectContaining({ code: "invalid_request" }),
    );
    expect(calls).toEqual([]);
  });

  it("answers 413 for a streamed body over the cap with no length", async () => {
    const calls = neverCalled();
    // A string body has no Content-Length header, so only the capped read can catch it.
    const { POST } = await import("../chat/route");
    const request = mockNextRequest({
      method: "POST",
      url: "http://localhost:3019/api/copilot/chat",
      rawBody: JSON.stringify({ query: "q".repeat(maxBytes + 1024) }),
    });
    expect(request.headers.get("content-length")).toBeNull();
    const res = await POST(request, {});
    expect(res.status).toBe(413);
    expect(calls).toEqual([]);
  });

  it("answers Malformed JSON for an unparsable body", async () => {
    const { POST } = await import("../chat/route");
    const res = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3019/api/copilot/chat",
        rawBody: "{nope",
      }),
      {},
    );
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Malformed JSON" }),
    );
  });

  it("refuses a clarification together with a plan step, without calling the gateway", async () => {
    const calls = neverCalled();
    const res = await postChat({
      sessionId,
      query: "q",
      model: "m",
      clarification: {
        answers: [{ question: "Which?", answer: "This" }],
        originalQuery: "q",
      },
      planStep: {
        plan: {
          plan_id: "p1",
          title: "t",
          status: "executing",
          steps: [{ step_id: "step_1", description: "d", agent: "data", reasoning: "r" }],
        },
        stepIndex: 0,
      },
    });
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each([
    ["HTML", "text/html; charset=utf-8"],
    ["JSON", "application/json"],
    ["XML", "text/xml"],
    ["XML", "application/xml"],
  ])(
    "answers 502 unreadable answer when the gateway sends %s with a 200 (%s)",
    async (_kind, contentType) => {
      server.use(
        http.post(
          `${gatewayUrl}/chatbrc/copilot-agent`,
          () =>
            new HttpResponse("<html>Maintenance</html>", {
              headers: { "Content-Type": contentType },
            }),
        ),
      );
      const res = await postChat({ sessionId, query: "q", model: "m" });
      expect(res.status).toBe(502);
      expect((await json<{ error: string }>(res)).error).toContain(
        "DXKB could not read",
      );
    },
  );

  it("passes text/event-stream with a charset through", async () => {
    server.use(
      http.post(
        `${gatewayUrl}/chatbrc/copilot-agent`,
        () =>
          new HttpResponse('event: done\ndata: {"job_id":"j1"}\n\n', {
            headers: { "Content-Type": "text/event-stream; charset=utf-8" },
          }),
      ),
    );
    const res = await postChat({ sessionId, query: "q", model: "m" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("event: done");
  });
});

describe("plans and workflow watches", () => {
  const plan = {
    plan_id: "p1",
    status: "executing",
    steps: [{ step_id: "step_1", description: "Find genomes", agent: "data" }],
  };

  it("saves a plan to the session it belongs to", async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${gatewayUrl}/chatbrc/plan/:planId/edit`, async ({ request, params }) => {
        sent = { planId: params.planId, body: await request.json() };
        return HttpResponse.json({ status: "updated" });
      }),
    );
    const { PUT } = await import("../sessions/[sessionId]/plans/[planId]/route");

    const saved = await PUT(
      mockNextRequest({ method: "PUT", body: { plan } }),
      makeRouteContext({ sessionId, planId: "p1" }),
    );
    expect(saved.status).toBe(204);
    expect(sent).toEqual({ planId: "p1", body: { session_id: sessionId, plan } });

    const mismatched = await PUT(
      mockNextRequest({ method: "PUT", body: { plan } }),
      makeRouteContext({ sessionId, planId: "p2" }),
    );
    expect(mismatched.status).toBe(400);
  });

  it("lists the session's watched jobs", async () => {
    server.use(
      http.get(`${gatewayUrl}/chatbrc/session/:id/workflow-watches`, () =>
        HttpResponse.json({
          watches: [
            { submission_id: "s1", workflow_id: "w1", status: "active", external_ids: ["1"] },
            { submission_id: "s2", status: "completed" },
          ],
          count: 2,
        }),
      ),
    );
    const { GET } = await import("../sessions/[sessionId]/workflow-watches/route");
    const res = await GET(mockNextRequest({}), makeRouteContext({ sessionId }));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      watches: [
        { submissionId: "s1", workflowId: "w1", status: "active" },
        { submissionId: "s2", workflowId: null, status: "completed" },
      ],
    });
  });
});

describe("GET /api/copilot/sessions/[sessionId]", () => {
  it("maps stored messages for the transcript", async () => {
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-session-messages`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("session_id")).toBe(sessionId);
        return HttpResponse.json({
          messages: [
            {
              message_id: "u1",
              role: "user",
              content: "Find genomes",
              timestamp: "2026-10-30T10:00:00Z",
              attachments: [
                { type: "file", name: "ids.txt", size: 120, mime_type: "text/plain" },
                { type: "image", source: "upload", name: "Image 1" },
                { type: "video", name: "skipped" },
              ],
            },
            {
              message_id: "a1",
              role: "assistant",
              content: "Found 12.",
              model: "m",
              rating: 1,
              agent_metadata: {
                steps: [
                  { step_id: "s1", phase: "tool", status: "done", label: "Searched", took_ms: 900 },
                  { step_id: "n1", phase: "note", status: "running", label: "live", transient: true },
                ],
              },
            },
            { message_id: "u2", role: "user", content: "Execute plan step: 2" },
            { message_id: "a2", role: "assistant", content: "  " },
            {
              message_id: "a3",
              role: "assistant",
              content: "",
              card: { card_type: "plan", card_payload: { plan_id: "p1", status: "draft" } },
              plan: { plan_id: "p1", status: "executing" },
            },
            {
              message_id: "c1",
              role: "user_clarification",
              content: "Answers: yes",
              clarificationAnswers: [{ question: "Host?", answer: "Human" }, { question: "x" }],
            },
            { role: "assistant", content: "no id" },
            { message_id: "s1", role: "system", content: "x" },
          ],
          active_job_id: "j9",
          execution_mode: "execute",
          workflow_ids: [],
        });
      }),
    );

    const { GET } = await import("../sessions/[sessionId]/route");
    const res = await GET(
      mockNextRequest({ url: `http://localhost:3019/api/copilot/sessions/${sessionId}` }),
      makeRouteContext({ sessionId }),
    );

    expect(res.status).toBe(200);
    const body = await json<{ messages: { id: string }[] }>(res);
    expect(body).toEqual(
      expect.objectContaining({ sessionId, activeJobId: "j9", executionMode: "execute" }),
    );
    expect(body.messages.map((message) => message.id)).toEqual(["u1", "a1", "a3", "c1"]);
    expect(body.messages[1]).toEqual({
      id: "a1",
      role: "assistant",
      content: "Found 12.",
      timestamp: null,
      model: "m",
      steps: [
        {
          stepId: "s1",
          phase: "tool",
          status: "done",
          label: "Searched",
          detail: null,
          result: null,
          agentLabel: null,
          tookMs: 900,
          transient: false,
        },
      ],
      card: null,
      rating: 1,
      persisted: true,
      systemInitiated: false,
      isClarification: false,
      clarificationAnswers: [],
      attachments: [],
    });
    expect(body.messages[0]).toEqual(
      expect.objectContaining({
        attachments: [
          { type: "file", name: "ids.txt", size: 120 },
          { type: "image", name: "Image 1", size: null },
        ],
      }),
    );
    expect(body.messages[2]).toEqual(
      expect.objectContaining({
        card: { cardType: "plan", payload: { plan_id: "p1", status: "executing" } },
      }),
    );
    expect(body.messages[3]).toEqual(
      expect.objectContaining({
        role: "user",
        isClarification: true,
        clarificationAnswers: [{ question: "Host?", answer: "Human" }],
      }),
    );
  });

  it("forwards an archived session as 404 SESSION_ARCHIVED", async () => {
    server.use(
      http.get(`${gatewayUrl}/chatbrc/get-session-messages`, () =>
        HttpResponse.json({ code: "SESSION_ARCHIVED", message: "This chat was deleted." }, { status: 404 }),
      ),
    );
    const { GET } = await import("../sessions/[sessionId]/route");
    const res = await GET(
      mockNextRequest({ url: `http://localhost:3019/api/copilot/sessions/${sessionId}` }),
      makeRouteContext({ sessionId }),
    );
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual(
      expect.objectContaining({ copilotCode: "SESSION_ARCHIVED", error: "This chat was deleted." }),
    );
  });

  it("refuses an id that is not a gateway id before calling it", async () => {
    const { GET } = await import("../sessions/[sessionId]/route");
    const res = await GET(
      mockNextRequest({ url: "http://localhost:3019/api/copilot/sessions/x" }),
      makeRouteContext({ sessionId: "a/b" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("session actions", () => {
  it("renames and deletes", async () => {
    const calls: { path: string; body: unknown }[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/:action`, async ({ request, params }) => {
        calls.push({ path: String(params.action), body: await request.json() });
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const route = await import("../sessions/[sessionId]/route");

    const renamed = await route.PATCH(
      mockNextRequest({ method: "PATCH", body: { title: " Mpox genomes " } }),
      makeRouteContext({ sessionId }),
    );
    expect(renamed.status).toBe(200);

    const deleted = await route.DELETE(
      mockNextRequest({ method: "DELETE" }),
      makeRouteContext({ sessionId }),
    );
    expect(deleted.status).toBe(204);

    expect(calls).toEqual([
      { path: "update-session-title", body: { session_id: sessionId, title: "Mpox genomes" } },
      { path: "delete-session", body: { session_id: sessionId } },
    ]);
  });

  it("sets the session's mode, and records No on an execution card", async () => {
    const calls: { path: string; body: unknown }[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/:action`, async ({ request, params }) => {
        calls.push({ path: String(params.action), body: await request.json() });
        return HttpResponse.json({ status: "ok" });
      }),
      http.post(`${gatewayUrl}/chatbrc/execution-question/answer`, async ({ request }) => {
        calls.push({ path: "execution-question/answer", body: await request.json() });
        return HttpResponse.json({ answer: "no" });
      }),
    );
    const session = await import("../sessions/[sessionId]/route");
    const answer = await import("../sessions/[sessionId]/execution-answer/route");
    const actions = [{ tool: "submit_gowe_job", summary: "Assemble" }];

    const mode = await session.PATCH(
      mockNextRequest({ method: "PATCH", body: { executionMode: "execute" } }),
      makeRouteContext({ sessionId }),
    );
    expect(await json(mode)).toEqual({ executionMode: "execute" });

    const declined = await answer.POST(
      mockNextRequest({ method: "POST", body: { actions } }),
      makeRouteContext({ sessionId }),
    );
    expect(declined.status).toBe(204);

    const invalid = await session.PATCH(
      mockNextRequest({ method: "PATCH", body: { executionMode: "sometimes" } }),
      makeRouteContext({ sessionId }),
    );
    expect(invalid.status).toBe(400);

    expect(calls).toEqual([
      { path: "update-session-execution-mode", body: { session_id: sessionId, execution_mode: "execute" } },
      { path: "execution-question/answer", body: { session_id: sessionId, actions, answer: "no" } },
    ]);
  });

  it("forwards an already-answered card as 409 REPLAY_ALREADY_RUN", async () => {
    server.use(
      http.post(`${gatewayUrl}/chatbrc/execution-question/answer`, () =>
        HttpResponse.json(
          { code: "REPLAY_ALREADY_RUN", message: "Those jobs were already submitted from this question." },
          { status: 409 },
        ),
      ),
    );
    const answer = await import("../sessions/[sessionId]/execution-answer/route");
    const res = await answer.POST(
      mockNextRequest({ method: "POST", body: { actions: [{ tool: "submit_gowe_job" }] } }),
      makeRouteContext({ sessionId }),
    );
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        copilotCode: "REPLAY_ALREADY_RUN",
        error: "Those jobs were already submitted from this question.",
      }),
    );
  });

  it("titles a session from its first question, without quotes, and saves it", async () => {
    const calls: { path: string; body: unknown }[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/:action`, async ({ request, params }) => {
        const body = await request.json();
        calls.push({ path: String(params.action), body });
        return params.action === "generate-title-from-messages"
          ? HttpResponse.json({ message: "success", response: '"Mpox genome search"' })
          : HttpResponse.json({ message: "ok" });
      }),
    );
    const { POST } = await import("../sessions/[sessionId]/title/route");
    const res = await POST(
      mockNextRequest({ method: "POST", body: { model: "m", question: "Find Mpox genomes" } }),
      makeRouteContext({ sessionId }),
    );
    expect(await json(res)).toEqual({ title: "Mpox genome search" });
    expect(calls[1]).toEqual({
      path: "update-session-title",
      body: { session_id: sessionId, title: "Mpox genome search" },
    });
  });

  it("refuses prepared actions over 200,000 characters on an execution card", async () => {
    const answer = await import("../sessions/[sessionId]/execution-answer/route");
    const res = await answer.POST(
      mockNextRequest({
        method: "POST",
        body: { actions: [{ tool: "submit_gowe_job", note: "x".repeat(200_001) }] },
      }),
      makeRouteContext({ sessionId }),
    );
    expect(res.status).toBe(400);
  });

  it("answers 413 for a title body over 1 MB, and Malformed JSON for bad JSON", async () => {
    const { POST } = await import("../sessions/[sessionId]/title/route");
    const big = await POST(
      mockNextRequest({
        method: "POST",
        body: { model: "m", question: "q".repeat(1024 * 1024 + 1) },
      }),
      makeRouteContext({ sessionId }),
    );
    expect(big.status).toBe(413);

    const bad = await POST(
      mockNextRequest({ method: "POST", rawBody: "{nope" }),
      makeRouteContext({ sessionId }),
    );
    expect(bad.status).toBe(400);
    expect(await json(bad)).toEqual(
      expect.objectContaining({ error: "Malformed JSON" }),
    );
  });

  it("refuses a title question over the query cap", async () => {
    const { POST } = await import("../sessions/[sessionId]/title/route");
    const res = await POST(
      mockNextRequest({
        method: "POST",
        body: { model: "m", question: "q".repeat(100_001) },
      }),
      makeRouteContext({ sessionId }),
    );
    expect(res.status).toBe(400);
  });

  it("keeps the title when the gateway declines to generate one", async () => {
    server.use(
      http.post(`${gatewayUrl}/chatbrc/generate-title-from-messages`, () =>
        HttpResponse.json({ message: "skipped", response: "New Chat" }),
      ),
    );
    const { POST } = await import("../sessions/[sessionId]/title/route");
    const res = await POST(
      mockNextRequest({ method: "POST", body: { model: "m", question: "q" } }),
      makeRouteContext({ sessionId }),
    );
    expect(await json(res)).toEqual({ title: null });
  });

  it("stops a session's turn, and answers 404 NO_TURN when none runs", async () => {
    let running = true;
    server.use(
      http.post(`${gatewayUrl}/chatbrc/session/:id/stop`, () =>
        running
          ? HttpResponse.json({ message: "Stop requested", job_id: "j1" }, { status: 202 })
          : HttpResponse.json({ code: "NO_TURN", message: "No turn is running in this chat" }, { status: 404 }),
      ),
    );
    const { POST } = await import("../sessions/[sessionId]/stop/route");

    const stopped = await POST(mockNextRequest({ method: "POST" }), makeRouteContext({ sessionId }));
    expect(stopped.status).toBe(202);
    expect(await json(stopped)).toEqual({ jobId: "j1" });

    running = false;
    const none = await POST(mockNextRequest({ method: "POST" }), makeRouteContext({ sessionId }));
    expect(none.status).toBe(404);
    expect(await json(none)).toEqual(expect.objectContaining({ copilotCode: "NO_TURN" }));
  });

  it("aborts a job and rates a message", async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${gatewayUrl}/chatbrc/job/:jobId/abort`, ({ params }) => {
        calls.push(`abort ${String(params.jobId)}`);
        return HttpResponse.json({ message: "Stop requested" }, { status: 202 });
      }),
      http.post(`${gatewayUrl}/chatbrc/rate-message`, async ({ request }) => {
        calls.push(`rate ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({ message: "ok" });
      }),
    );
    const abort = await import("../jobs/[jobId]/abort/route");
    const rating = await import("../messages/[messageId]/rating/route");

    const aborted = await abort.POST(mockNextRequest({ method: "POST" }), makeRouteContext({ jobId: "j1" }));
    expect(aborted.status).toBe(202);

    const rated = await rating.POST(
      mockNextRequest({ method: "POST", body: { rating: -1 } }),
      makeRouteContext({ messageId: "a1" }),
    );
    expect(rated.status).toBe(204);

    const invalid = await rating.POST(
      mockNextRequest({ method: "POST", body: { rating: 5 } }),
      makeRouteContext({ messageId: "a1" }),
    );
    expect(invalid.status).toBe(400);

    expect(calls).toEqual(["abort j1", 'rate {"message_id":"a1","rating":-1}']);
  });
});
