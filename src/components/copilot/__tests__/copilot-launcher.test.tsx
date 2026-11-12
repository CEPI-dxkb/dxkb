import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopilotLauncher } from "../copilot-launcher";
import { useOptionalCopilot } from "../copilot-provider";
import { fakeCopilot } from "./fixtures/fake-copilot";

vi.mock("../copilot-provider", () => ({ useOptionalCopilot: vi.fn() }));

describe("CopilotLauncher", () => {
  it("opens a closed chat", async () => {
    const copilot = fakeCopilot({ openSurface: null });
    vi.mocked(useOptionalCopilot).mockReturnValue(copilot);
    render(<CopilotLauncher />);

    const button = screen.getByRole("button", { name: "Open AskClark" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(copilot.open).toHaveBeenCalledWith();
  });

  it("minimizes an open chat instead of closing it", async () => {
    const copilot = fakeCopilot({ openSurface: "floating" });
    vi.mocked(useOptionalCopilot).mockReturnValue(copilot);
    render(<CopilotLauncher />);

    const button = screen.getByRole("button", { name: "Minimize AskClark" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(button);
    expect(copilot.minimize).toHaveBeenCalledTimes(1);
    expect(copilot.close).not.toHaveBeenCalled();
  });

  it("restores a minimized chat", async () => {
    const copilot = fakeCopilot({ minimized: true });
    vi.mocked(useOptionalCopilot).mockReturnValue(copilot);
    render(<CopilotLauncher compact />);

    const button = screen.getByRole("button", { name: "Restore AskClark" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(copilot.restore).toHaveBeenCalledTimes(1);
  });

  it("shows the dot only for an answer that arrived while minimized, as the tab does", () => {
    const dot = () => document.querySelector(".bg-info");
    vi.mocked(useOptionalCopilot).mockReturnValue(
      fakeCopilot({ minimized: true, unread: false }),
    );
    const { rerender } = render(<CopilotLauncher />);
    expect(dot()).toBeNull();

    vi.mocked(useOptionalCopilot).mockReturnValue(
      fakeCopilot({ minimized: true, unread: true }),
    );
    rerender(<CopilotLauncher />);
    expect(dot()).not.toBeNull();
  });

  it("is absent on the full page and when signed out", () => {
    vi.mocked(useOptionalCopilot).mockReturnValue(
      fakeCopilot({ onCopilotPage: true, openSurface: null }),
    );
    const { rerender } = render(<CopilotLauncher />);
    expect(screen.queryByRole("button")).toBeNull();

    vi.mocked(useOptionalCopilot).mockReturnValue(fakeCopilot({ available: false }));
    rerender(<CopilotLauncher />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
