import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { copilotQueryKeys } from "@/lib/copilot/client";
import { server } from "@/test-helpers/msw-server";
import { reloadCopilotSession } from "../use-copilot-queries";

const sessionId = "11111111-2222-3333-4444-555555555555";

function session(messages: number) {
  return {
    sessionId,
    messages: Array.from({ length: messages }, (_, index) => ({
      id: `m${String(index)}`,
      role: "user",
      content: "Hi",
    })),
    executionMode: "plan",
    activeJobId: null,
  };
}

describe("reloadCopilotSession", () => {
  it("resolves null once the cache holds the fresh session", async () => {
    server.use(
      http.get("*/api/copilot/sessions/:id", () => HttpResponse.json(session(2))),
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(copilotQueryKeys.session(sessionId), session(0));

    await expect(reloadCopilotSession(queryClient, sessionId)).resolves.toBeNull();
    expect(
      queryClient.getQueryData<{ messages: unknown[] }>(copilotQueryKeys.session(sessionId))
        ?.messages,
    ).toHaveLength(2);
  });

  it("reports the failure of the reload that superseded it, not the old cache", async () => {
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const sessionGets = vi.fn();
    server.use(
      http.get("*/api/copilot/sessions/:id", async () => {
        sessionGets();
        if (sessionGets.mock.calls.length === 1) {
          await firstGate;
          return HttpResponse.json(session(2));
        }
        return HttpResponse.json(
          { error: "The BV-BRC Copilot service did not respond.", code: "upstream" },
          { status: 500 },
        );
      }),
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(copilotQueryKeys.session(sessionId), session(0));

    const first = reloadCopilotSession(queryClient, sessionId);
    await vi.waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });
    // The second reload cancels the first one's fetch, and its own fails.
    const second = reloadCopilotSession(queryClient, sessionId);

    await expect(second).resolves.toBe("The BV-BRC Copilot service did not respond.");
    await expect(first).resolves.toBe("The BV-BRC Copilot service did not respond.");
    releaseFirst();
  });

  it("does not report fresh after a rating cancels its fetch and writes the old cache", async () => {
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const sessionGets = vi.fn();
    server.use(
      http.get("*/api/copilot/sessions/:id", async () => {
        sessionGets();
        if (sessionGets.mock.calls.length === 1) await firstGate;
        return HttpResponse.json(session(2));
      }),
    );
    const queryClient = new QueryClient();
    const key = copilotQueryKeys.session(sessionId);
    queryClient.setQueryData(key, session(0));

    const reload = reloadCopilotSession(queryClient, sessionId);
    await vi.waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });
    // What a rating click does: cancel the session read, then write the
    // optimistic rating into the (pre-turn) cache. The write lands before the
    // reload resumes from the cancel, the order that fooled an update count.
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, session(0));

    await expect(reload).resolves.toBeNull();
    expect(
      queryClient.getQueryData<{ messages: unknown[] }>(key)?.messages,
    ).toHaveLength(2);
    releaseFirst();
  });

  it("starts a new fetch when its fetch is cancelled with nothing cached", async () => {
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const sessionGets = vi.fn();
    server.use(
      http.get("*/api/copilot/sessions/:id", async () => {
        sessionGets();
        if (sessionGets.mock.calls.length === 1) await firstGate;
        return HttpResponse.json(session(2));
      }),
    );
    const queryClient = new QueryClient();
    const key = copilotQueryKeys.session(sessionId);

    const reload = reloadCopilotSession(queryClient, sessionId);
    await vi.waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });
    await queryClient.cancelQueries({ queryKey: key });

    await expect(reload).resolves.toBeNull();
    expect(sessionGets).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData<{ messages: unknown[] }>(key)?.messages,
    ).toHaveLength(2);
    releaseFirst();
  });
});
