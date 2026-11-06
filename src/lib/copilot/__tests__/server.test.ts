vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { bvbrcServerUserAgent } from "@/lib/api/server-user-agent";
import {
  deleteCopilotSession,
  openCopilotTurn,
  readCopilotModels,
  readCopilotSession,
  readCopilotSessions,
} from "../server";

const gatewayUrl = "http://copilot.test/copilot-api";
const token = "un=testuser|tokenid=1|sig=abc";
const sessionId = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  vi.stubEnv("COPILOT_API_URL", gatewayUrl);
});

describe("Copilot gateway requests", () => {
  // Cloudflare in front of the gateway answers Node's default user agent with
  // a "Just a moment..." challenge (HTTP 403), so every call must override it.
  it("send the BV-BRC server user agent from every fetch helper", async () => {
    const seen: { path: string; userAgent: string | null }[] = [];
    server.use(
      http.all(`${gatewayUrl}/*`, ({ request }) => {
        seen.push({
          path: new URL(request.url).pathname,
          userAgent: request.headers.get("user-agent"),
        });
        return HttpResponse.json({ message: "stop here" }, { status: 400 });
      }),
    );

    const calls = [
      readCopilotModels(token),
      readCopilotSessions(token, { limit: 20, offset: 0 }),
      readCopilotSession(token, sessionId),
      deleteCopilotSession(token, sessionId),
      openCopilotTurn(
        token,
        { sessionId, query: "hello", model: "gpt-oss-120b" },
        new AbortController().signal,
      ),
    ];
    const results = await Promise.allSettled(calls);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(seen.map(({ path }) => path).sort()).toEqual(
      [
        "/copilot-api/chatbrc/copilot-agent",
        "/copilot-api/chatbrc/delete-session",
        "/copilot-api/chatbrc/get-all-sessions",
        "/copilot-api/chatbrc/get-session-messages",
        "/copilot-api/db/get-model-list",
      ].sort(),
    );
    for (const request of seen) {
      expect(request).toEqual({
        path: request.path,
        userAgent: bvbrcServerUserAgent,
      });
    }
  });
});
