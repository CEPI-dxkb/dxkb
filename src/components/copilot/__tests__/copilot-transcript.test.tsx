import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CopilotChatError } from "@/hooks/copilot/use-copilot-chat";
import { startCopilotTurn } from "@/lib/copilot/turn";
import type { CopilotSessionDetail } from "@/lib/copilot/types";
import { CopilotTranscript } from "../copilot-transcript";
import { copilotName } from "@/lib/copilot/name";
import { createQueryClientWrapper } from "@/test-helpers/react";

const detail: CopilotSessionDetail = {
  sessionId: "s1",
  messages: [],
  executionMode: "plan",
  activeJobId: null,
};

function renderTranscript(error: CopilotChatError) {
  const onReload = vi.fn();
  const onRetry = vi.fn();
  render(
    <CopilotTranscript
      sessionId="s1"
      detail={detail}
      loading={false}
      loadError={null}
      onRetryLoad={vi.fn()}
      onReload={onReload}
      active={null}
      error={error}
      onRetry={onRetry}
      onSuggestion={vi.fn()}
    />,
  );
  return { onReload, onRetry };
}

describe("CopilotTranscript errors", () => {
  it("offers Reload, not Retry, when the chat could not be read back", async () => {
    const user = userEvent.setup();
    const { onReload, onRetry } = renderTranscript({
      sessionId: "s1",
      kind: "reload",
      message: "The BV-BRC Copilot service did not respond.",
      query: null,
    });

    expect(screen.getByText("Could not reload this chat")).toBeInTheDocument();
    expect(
      screen.getByText("The BV-BRC Copilot service did not respond."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("offers no Retry for a failed turn that cannot be resent as text", () => {
    renderTranscript({
      sessionId: "s1",
      kind: "turn",
      message: "The model is overloaded.",
      query: null,
    });

    expect(screen.getByText(`${copilotName} could not answer`)).toBeInTheDocument();
    expect(screen.getByText("The model is overloaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  });

  it("retries a failed plain question with its text", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderTranscript({
      sessionId: "s1",
      kind: "turn",
      message: "The model is overloaded.",
      query: "old q",
    });

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("old q");
  });
});

describe("CopilotTranscript live turn", () => {
  it("marks a turn whose connection dropped, keeping its partial answer", () => {
    render(
      <CopilotTranscript
        sessionId="s1"
        detail={detail}
        loading={false}
        loadError={null}
        onRetryLoad={vi.fn()}
        onReload={vi.fn()}
        active={{
          sessionId: "s1",
          turn: {
            ...startCopilotTurn("t1", "Find Mpox genomes"),
            status: "disconnected",
            answer: "Partial answer",
          },
          baseCount: 0,
          clarificationAnswers: null,
          hidden: false,
          attachments: [],
          keptAtDelivery: 1,
        }}
        error={null}
        onRetry={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText("Connection lost")).toBeInTheDocument();
    expect(screen.getByText("Partial answer")).toBeInTheDocument();
    expect(screen.queryByText("Stopped")).not.toBeInTheDocument();
  });
});

describe("CopilotTranscript scrolling", () => {
  const itemHeight = 200;
  const viewportHeight = 300;
  const scrollTops = new WeakMap<Element, number>();

  function message(id: string, role: "user" | "assistant", content: string) {
    return {
      id,
      role,
      content,
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
    } satisfies CopilotSessionDetail["messages"][number];
  }

  function viewportOf(element: Element) {
    return element.closest('[data-slot="message-scroller-viewport"]');
  }

  // jsdom has no layout: stack the items 200px apart in a 300px viewport.
  function rect(top: number, height: number) {
    return DOMRect.fromRect({ x: 0, y: top, width: 400, height });
  }

  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.getAttribute("data-slot") === "message-scroller-viewport") {
          return rect(0, viewportHeight);
        }
        const viewport = viewportOf(this);
        const id = this.getAttribute("data-message-id");
        if (!viewport || !id || !this.parentElement) return rect(0, 0);
        const items = Array.from(this.parentElement.children).filter((child) =>
          child.hasAttribute("data-message-id"),
        );
        const scrollTop = scrollTops.get(viewport) ?? 0;
        return rect(items.indexOf(this) * itemHeight - scrollTop, itemHeight);
      },
    );
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
      function (this: Element) {
        return this.getAttribute("data-slot") === "message-scroller-viewport"
          ? viewportHeight
          : 0;
      },
    );
    vi.spyOn(Element.prototype, "scrollTop", "get").mockImplementation(
      function (this: Element) {
        return scrollTops.get(this) ?? 0;
      },
    );
    vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(
      function (this: Element, value: number) {
        scrollTops.set(this, value);
      },
    );
    Element.prototype.scrollTo = function (
      this: Element,
      options?: ScrollToOptions | number,
    ) {
      if (typeof options === "object" && options.top !== undefined) {
        scrollTops.set(this, options.top);
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays on the new question when a finished turn is replaced by its saved copy", async () => {
    const earlier = [
      message("m1", "user", "First question"),
      message("m2", "assistant", "First answer"),
      message("m3", "user", "Second question"),
      message("m4", "assistant", "Second answer"),
    ];
    const props = {
      sessionId: "s1",
      loading: false,
      loadError: null,
      onRetryLoad: vi.fn(),
      onReload: vi.fn(),
      error: null,
      onRetry: vi.fn(),
      onSuggestion: vi.fn(),
    };
    const { rerender } = render(
      <CopilotTranscript
        {...props}
        detail={{ ...detail, messages: earlier }}
        active={{
          sessionId: "s1",
          turn: {
            ...startCopilotTurn("t1", "Third question"),
            status: "done",
            answer: "Third answer",
          },
          baseCount: earlier.length,
          clarificationAnswers: null,
          hidden: false,
          attachments: [],
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );
    const viewport = screen.getByRole("region", {
      name: `${copilotName} conversation`,
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    // Opening the chat shows the live question at the top.
    expect(viewport.scrollTop).toBe(4 * itemHeight - 64);

    rerender(
      <CopilotTranscript
        {...props}
        detail={{
          ...detail,
          messages: [
            ...earlier,
            message("m5", "user", "Third question"),
            message("m6", "assistant", "Third answer"),
          ],
        }}
        active={null}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // The saved question sits fifth (index 4); it is shown at the top, with
    // the default 64px of the previous answer peeking above it.
    expect(viewport.scrollTop).toBe(4 * itemHeight - 64);
  });
});
