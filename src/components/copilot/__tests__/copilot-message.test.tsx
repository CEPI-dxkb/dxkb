import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { copilotQueryKeys } from "@/lib/copilot/client";
import type { CopilotMessage, CopilotSessionDetail } from "@/lib/copilot/types";
import { server } from "@/test-helpers/msw-server";
import { CopilotAssistantMessage } from "../copilot-message";

function message(id: string): CopilotMessage {
  return {
    id,
    role: "assistant",
    content: `Answer ${id}`,
    timestamp: null,
    model: null,
    steps: [],
    card: null,
    rating: null,
    persisted: true,
    systemInitiated: false,
    isClarification: false,
    clarificationAnswers: [],
    attachments: [],
  };
}

function ratingOf(queryClient: QueryClient, id: string) {
  return queryClient
    .getQueryData<CopilotSessionDetail>(copilotQueryKeys.session("s1"))
    ?.messages.find((item) => item.id === id)?.rating;
}

describe("RatingButtons", () => {
  it("reverts only the failed message's rating", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const messages = [message("A"), message("B")];
    queryClient.setQueryData<CopilotSessionDetail>(copilotQueryKeys.session("s1"), {
      sessionId: "s1",
      messages,
      executionMode: "execute",
      activeJobId: null,
    });

    let releaseA: () => void = () => undefined;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    server.use(
      http.post("*/api/copilot/messages/A/rating", async () => {
        await gateA;
        return HttpResponse.json({ error: "Rating A failed" }, { status: 500 });
      }),
      http.post("*/api/copilot/messages/B/rating", () => HttpResponse.json({})),
    );

    render(
      <QueryClientProvider client={queryClient}>
        {messages.map((item) => (
          <div key={item.id} data-testid={`msg-${item.id}`}>
            <CopilotAssistantMessage sessionId="s1" message={item} />
          </div>
        ))}
      </QueryClientProvider>,
    );

    await user.click(
      within(screen.getByTestId("msg-A")).getByRole("button", { name: "Good answer" }),
    );
    await waitFor(() => {
      expect(ratingOf(queryClient, "A")).toBe(1);
    });
    await user.click(
      within(screen.getByTestId("msg-B")).getByRole("button", { name: "Good answer" }),
    );
    await waitFor(() => {
      expect(ratingOf(queryClient, "B")).toBe(1);
    });

    releaseA();
    await waitFor(() => {
      expect(ratingOf(queryClient, "A")).toBeNull();
    });
    expect(ratingOf(queryClient, "B")).toBe(1);
  });

  it("keeps a newer rating when an older one fails to save", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    onTestFinished(() => {
      toastError.mockRestore();
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const messages = [message("A")];
    queryClient.setQueryData<CopilotSessionDetail>(copilotQueryKeys.session("s1"), {
      sessionId: "s1",
      messages,
      executionMode: "execute",
      activeJobId: null,
    });

    const { promise: goodHeld, resolve: releaseGood } = Promise.withResolvers<undefined>();
    let poorSaved = false;
    server.use(
      http.post("*/api/copilot/messages/A/rating", async ({ request }) => {
        const { rating } = (await request.json()) as { rating: number };
        if (rating === 1) {
          await goodHeld;
          return HttpResponse.json({ error: "Rating Good failed" }, { status: 500 });
        }
        poorSaved = true;
        return HttpResponse.json({});
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CopilotAssistantMessage sessionId="s1" message={messages[0]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Good answer" }));
    await waitFor(() => {
      expect(ratingOf(queryClient, "A")).toBe(1);
    });
    await user.click(screen.getByRole("button", { name: "Poor answer" }));
    await waitFor(() => {
      expect(poorSaved).toBe(true);
    });
    expect(ratingOf(queryClient, "A")).toBe(-1);

    releaseGood(undefined);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Could not save your rating", {
        description: "Rating Good failed",
      });
    });
    expect(ratingOf(queryClient, "A")).toBe(-1);
  });

  it("keeps a newer rating of the same value when an older save fails", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    onTestFinished(() => {
      toastError.mockRestore();
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const messages = [message("A")];
    queryClient.setQueryData<CopilotSessionDetail>(copilotQueryKeys.session("s1"), {
      sessionId: "s1",
      messages,
      executionMode: "execute",
      activeJobId: null,
    });

    const { promise: firstGoodHeld, resolve: releaseFirstGood } =
      Promise.withResolvers<undefined>();
    const saved: number[] = [];
    let goodRequests = 0;
    server.use(
      http.post("*/api/copilot/messages/A/rating", async ({ request }) => {
        const { rating } = (await request.json()) as { rating: number };
        if (rating === 1) {
          goodRequests += 1;
          if (goodRequests === 1) {
            await firstGoodHeld;
            return HttpResponse.json({ error: "Rating Good failed" }, { status: 500 });
          }
        }
        saved.push(rating);
        return HttpResponse.json({});
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CopilotAssistantMessage sessionId="s1" message={messages[0]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Good answer" }));
    await waitFor(() => {
      expect(ratingOf(queryClient, "A")).toBe(1);
    });
    await user.click(screen.getByRole("button", { name: "Poor answer" }));
    await waitFor(() => {
      expect(saved).toEqual([-1]);
    });
    await user.click(screen.getByRole("button", { name: "Good answer" }));
    await waitFor(() => {
      expect(saved).toEqual([-1, 1]);
    });
    expect(ratingOf(queryClient, "A")).toBe(1);

    releaseFirstGood(undefined);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Could not save your rating", {
        description: "Rating Good failed",
      });
    });
    expect(ratingOf(queryClient, "A")).toBe(1);
  });

  it("rolls back to the last saved rating when overlapping saves both fail", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    onTestFinished(() => {
      toastError.mockRestore();
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const messages = [message("A")];
    queryClient.setQueryData<CopilotSessionDetail>(copilotQueryKeys.session("s1"), {
      sessionId: "s1",
      messages,
      executionMode: "execute",
      activeJobId: null,
    });

    const { promise: goodHeld, resolve: releaseGood } = Promise.withResolvers<undefined>();
    const { promise: poorHeld, resolve: releasePoor } = Promise.withResolvers<undefined>();
    const received: number[] = [];
    server.use(
      http.post("*/api/copilot/messages/A/rating", async ({ request }) => {
        const { rating } = (await request.json()) as { rating: number };
        received.push(rating);
        await (rating === 1 ? goodHeld : poorHeld);
        return HttpResponse.json({ error: `Rating ${String(rating)} failed` }, { status: 500 });
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CopilotAssistantMessage sessionId="s1" message={messages[0]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Good answer" }));
    await user.click(screen.getByRole("button", { name: "Poor answer" }));
    await waitFor(() => {
      expect(received).toEqual([1, -1]);
    });
    expect(ratingOf(queryClient, "A")).toBe(-1);

    releaseGood(undefined);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(ratingOf(queryClient, "A")).toBe(-1);
    releasePoor(undefined);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(2);
    });
    // Neither save reached the server: the stored rating (none) comes back,
    // not Good, which the newer click's snapshot held.
    expect(ratingOf(queryClient, "A")).toBeNull();
  });
});
