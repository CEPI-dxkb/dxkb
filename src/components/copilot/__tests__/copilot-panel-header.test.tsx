import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copilotPagePath } from "@/lib/copilot/paths";
import { CopilotPanelHeader, type CopilotPanelVariant } from "../copilot-panel-header";
import { useCopilot } from "../copilot-provider";
import { fakeCopilot } from "./fixtures/fake-copilot";

vi.mock("../copilot-provider", () => ({ useCopilot: vi.fn() }));

function renderHeader(
  variant: CopilotPanelVariant,
  props: Partial<Parameters<typeof CopilotPanelHeader>[0]> = {},
) {
  const handlers = {
    onToggleHistory: vi.fn(),
    onNewChat: vi.fn(),
    onClose: vi.fn(),
    onMinimize: vi.fn(),
  };
  render(
    <CopilotPanelHeader
      variant={variant}
      title="Genome counts"
      showHistory={false}
      newChatDisabled={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

beforeEach(() => {
  vi.mocked(useCopilot).mockReturnValue(fakeCopilot());
});

describe("CopilotPanelHeader in the side panel and floating window", () => {
  it("lays out history, title, new chat, layout, minimize and close in one row", async () => {
    const handlers = renderHeader("sheet");
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual([
      "Your earlier chats",
      "New chat",
      "Change AskClark layout",
      "Minimize AskClark",
      "Close AskClark",
    ]);
    expect(screen.queryByRole("button", { name: /options/i })).toBeNull();
    expect(screen.getByText("Beta")).toHaveClass("hidden", "@sm:inline");

    await userEvent.click(screen.getByRole("button", { name: "Minimize AskClark" }));
    expect(handlers.onMinimize).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close AskClark" }));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("turns the history button into a back arrow in the chat list", () => {
    renderHeader("floating", { showHistory: true });
    const back = screen.getByRole("button", { name: "Back to the chat" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading")).toHaveTextContent("Your chats");
  });
});

describe("CopilotPanelHeader on the full page", () => {
  it("keeps a labelled Chats button and has no layout menu", () => {
    renderHeader("page", { onClose: undefined, onMinimize: undefined });
    expect(screen.getByRole("button", { name: "Chats" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("button", { name: "Change AskClark layout" })).toBeNull();
    expect(screen.getByText("Beta")).not.toHaveClass("hidden");
  });
});

describe("CopilotLayoutMenu", () => {
  it.each([
    ["sheet", "Side panel", "Floating window", "floating"],
    ["floating", "Floating window", "Side panel", "sheet"],
  ] as const)(
    "in the %s disables the current surface and switches to the other",
    async (variant, current, other, target) => {
      const copilot = fakeCopilot({ openSurface: variant });
      vi.mocked(useCopilot).mockReturnValue(copilot);
      renderHeader(variant);

      await userEvent.click(screen.getByRole("button", { name: "Change AskClark layout" }));
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("Show AskClark as")).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: current })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(within(menu).getByRole("menuitem", { name: "Full page" })).toHaveAttribute(
        "href",
        copilotPagePath,
      );

      await userEvent.click(within(menu).getByRole("menuitem", { name: other }));
      expect(copilot.open).toHaveBeenCalledWith(target);
    },
  );
});
