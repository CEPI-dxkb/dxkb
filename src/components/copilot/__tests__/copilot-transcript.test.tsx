import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CopilotChatError } from "@/hooks/copilot/use-copilot-chat";
import { startCopilotTurn } from "@/lib/copilot/turn";
import type { CopilotSessionDetail } from "@/lib/copilot/types";
import { CopilotTranscript } from "../copilot-transcript";
import { copilotName } from "@/lib/copilot/name";

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
