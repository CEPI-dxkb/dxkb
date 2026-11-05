import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
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
});
