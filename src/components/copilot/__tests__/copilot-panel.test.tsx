import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import type { CopilotChat, CopilotChatError } from "@/hooks/copilot/use-copilot-chat";
import { copilotQueryKeys } from "@/lib/copilot/client";
import { clearCopilotDrafts } from "@/lib/copilot/drafts";
import type { CopilotMessage, CopilotSessionDetail } from "@/lib/copilot/types";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { CopilotPanel, type CopilotPanelVariant } from "../copilot-panel";
import { useCopilot } from "../copilot-provider";
import { useCopilotActions } from "../use-copilot-actions";
import { copilotName } from "@/lib/copilot/name";

// The provider and turn driver are faked; session reads go through MSW.
vi.mock("../copilot-provider", () => ({
  useCopilot: vi.fn(),
  useOptionalCopilot: vi.fn(),
}));
vi.mock("../use-copilot-actions", () => ({
  useCopilotActions: vi.fn(),
  newestCopilotPlan: () => null,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

type CopilotValue = ReturnType<typeof useCopilot>;
type CopilotActions = ReturnType<typeof useCopilotActions>;

const sendTurn = vi.fn<CopilotActions["sendTurn"]>();
const sendQuestion = vi.fn<CopilotActions["sendQuestion"]>();

function fakeChat(overrides: Partial<CopilotChat> = {}): CopilotChat {
  return {
    active: null,
    error: null,
    stopping: false,
    dismissError: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    reload: vi.fn(),
    pausedPlans: new Set(),
    pausePlan: vi.fn(),
    resumePlan: vi.fn(),
    isPlanPaused: () => false,
    ...overrides,
  };
}

function fakeCopilot(
  overrides: { sessionId?: string; chat?: Partial<CopilotChat> } = {},
): CopilotValue {
  return {
    available: true,
    username: "alice",
    onCopilotPage: false,
    openSurface: "sheet",
    preferredSurface: "sheet",
    open: vi.fn(),
    close: vi.fn(),
    sessionId: overrides.sessionId ?? "s1",
    selectSession: vi.fn(),
    newChat: vi.fn(),
    models: [
      {
        model: "m1",
        modelType: null,
        priority: null,
        maxTokens: null,
        supportsImage: true,
        isDefault: true,
      },
    ],
    modelsError: null,
    modelsLoading: false,
    model: "m1",
    setModel: vi.fn(),
    chat: fakeChat(overrides.chat),
  };
}

function fakeActions(): CopilotActions {
  return {
    sendTurn,
    sendQuestion,
    cardActions: {} as CopilotActions["cardActions"],
    planActions: {} as CopilotActions["planActions"],
    stepAwaitingReply: () => null,
  };
}

function sessionDetail(sessionId: string): CopilotSessionDetail {
  return { sessionId, messages: [], executionMode: "plan", activeJobId: null };
}

function useBackend() {
  server.use(
    http.get("*/api/copilot/sessions", () =>
      HttpResponse.json({ sessions: [], total: 0, hasMore: false }),
    ),
    http.get("*/api/copilot/sessions/:id/workflow-watches", () =>
      HttpResponse.json({ watches: [] }),
    ),
    http.get("*/api/copilot/sessions/:id", ({ params }) =>
      HttpResponse.json(sessionDetail(String(params.id))),
    ),
  );
}

function renderPanel(variant: CopilotPanelVariant = "sheet") {
  const wrapper = createQueryClientWrapper();
  return render(<CopilotPanel variant={variant} />, { wrapper });
}

function box(): HTMLElement {
  return screen.getByRole("textbox", { name: `Ask ${copilotName}` });
}

async function ready() {
  await waitFor(() => {
    expect(box()).toBeEnabled();
  });
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  return input;
}

async function stageDraft(container: HTMLElement) {
  const user = userEvent.setup();
  await user.type(box(), "next question");
  await user.upload(
    fileInput(container),
    new File(["hello"], "notes.txt", { type: "text/plain" }),
  );
  await screen.findByRole("button", { name: "Remove notes.txt" });
  return user;
}

beforeEach(() => {
  useBackend();
  sendTurn.mockResolvedValue({ status: "busy" });
  sendQuestion.mockResolvedValue({ sent: true, message: null });
  vi.mocked(useCopilotActions).mockReturnValue(fakeActions());
  vi.mocked(useCopilot).mockReturnValue(fakeCopilot());
});

afterEach(() => {
  clearCopilotDrafts();
});

describe("CopilotPanel", () => {
  it("retries a failed question exactly, leaving the draft and its file (C11)", async () => {
    const error: CopilotChatError = {
      sessionId: "s1",
      kind: "turn",
      message: "The model is overloaded.",
      query: "old q",
    };
    vi.mocked(useCopilot).mockReturnValue(fakeCopilot({ chat: { error } }));
    const { container } = renderPanel();
    await ready();
    const user = await stageDraft(container);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn).toHaveBeenCalledWith("old q");
    expect(sendQuestion).not.toHaveBeenCalled();
    expect(box()).toHaveValue("next question");
    expect(screen.getByRole("button", { name: "Remove notes.txt" })).toBeInTheDocument();
  });

  it("keeps the draft and its files when the surface changes (C49)", async () => {
    const first = renderPanel("sheet");
    await ready();
    await stageDraft(first.container);
    first.unmount();

    renderPanel("floating");
    await ready();
    expect(box()).toHaveValue("next question");
    expect(screen.getByRole("button", { name: "Remove notes.txt" })).toBeInTheDocument();
  });

  it("shows each chat's own draft (C48)", async () => {
    const { container, rerender } = renderPanel();
    await ready();
    await stageDraft(container);

    vi.mocked(useCopilot).mockReturnValue(fakeCopilot({ sessionId: "s2" }));
    rerender(<CopilotPanel variant="sheet" />);
    await ready();

    expect(box()).toHaveValue("");
    expect(screen.queryByRole("list", { name: "Attached files" })).not.toBeInTheDocument();
  });

  it("sends the draft with its file, and gives it back when the send is refused", async () => {
    sendQuestion.mockResolvedValue({ sent: false, message: `${copilotName} did not respond.` });
    const { container } = renderPanel();
    await ready();
    const user = await stageDraft(container);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendQuestion).toHaveBeenCalledWith("next question", {
      model: "m1",
      files: [{ name: "notes.txt", content: "hello", mimeType: "text/plain", size: 5 }],
    });
    await waitFor(() => {
      expect(box()).toHaveValue("next question");
    });
    expect(screen.getByRole("button", { name: "Remove notes.txt" })).toBeInTheDocument();
  });

  it("says the question was not sent when something was typed during the send", async () => {
    const toastError = vi.spyOn(toast, "error");
    const refused = Promise.withResolvers<{ sent: boolean; message: string | null }>();
    sendQuestion.mockReturnValue(refused.promise);
    const { container } = renderPanel();
    await ready();
    const user = await stageDraft(container);

    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(box()).toHaveValue("");
    });
    await user.type(box(), "a follow-up");
    refused.resolve({ sent: false, message: `${copilotName} did not respond.` });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Your question was not sent", {
        description: `${copilotName} did not respond. Your question: “next question”`,
      });
    });
    expect(box()).toHaveValue("a follow-up");
    toastError.mockRestore();
  });

  it("disables Send while a stopped answer is still settling", async () => {
    const { rerender } = renderPanel();
    await ready();
    const user = userEvent.setup();
    await user.type(box(), "next question");
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );

    vi.mocked(useCopilot).mockReturnValue(fakeCopilot({ chat: { stopping: true } }));
    rerender(<CopilotPanel variant="sheet" />);

    expect(box()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("cancels a file dropped outside the composer, so the page stays (C8)", async () => {
    renderPanel();
    await ready();
    const target = screen.getByText(`Ask ${copilotName}`);

    for (const type of ["dragOver", "drop"] as const) {
      const event = createEvent[type](target, {
        dataTransfer: { types: ["Files"], files: [], dropEffect: "" },
      });
      fireEvent(target, event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});

describe("CopilotPanel markdown renderer", () => {
  it("holds the chat until the renderer is in, so a stored answer never shows as plain text", async () => {
    const renderer = Promise.withResolvers<undefined>();
    vi.doMock("../copilot-markdown", async (importOriginal) => {
      await renderer.promise;
      return importOriginal();
    });
    onTestFinished(() => {
      vi.doUnmock("../copilot-markdown");
    });
    // A fresh module graph, so nothing has loaded the renderer yet. The mocked
    // modules come back as fresh mocks and are set up again.
    vi.resetModules();
    vi.mocked((await import("../copilot-provider")).useCopilot).mockReturnValue(
      fakeCopilot(),
    );
    vi.mocked(
      (await import("../use-copilot-actions")).useCopilotActions,
    ).mockReturnValue(fakeActions());
    const { CopilotPanel: FreshPanel } = await import("../copilot-panel");
    const stored: CopilotMessage = {
      id: "a1",
      role: "assistant",
      content: "Found **12** genomes",
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
    server.use(
      http.get("*/api/copilot/sessions/:id", ({ params }) =>
        HttpResponse.json({ ...sessionDetail(String(params.id)), messages: [stored] }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <FreshPanel variant="sheet" />
      </QueryClientProvider>,
    );
    // Every node the transcript ever adds, so a plain-text frame that was
    // replaced at once is still seen.
    let showedRawText = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.textContent?.includes("**12**")) showedRawText = true;
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    onTestFinished(() => {
      observer.disconnect();
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(copilotQueryKeys.session("s1"))).toBeDefined();
    });
    // The chat is read, but the renderer is not in: still loading.
    expect(screen.getByLabelText("Loading chat")).toBeInTheDocument();
    expect(box()).toBeDisabled();

    renderer.resolve(undefined);
    await ready();
    expect(screen.getByText("12", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading chat")).not.toBeInTheDocument();
    expect(showedRawText).toBe(false);
  });
});
