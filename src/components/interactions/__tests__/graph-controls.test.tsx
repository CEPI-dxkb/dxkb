import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphControls } from "../graph-controls";

function toggle() {
  return screen.getByRole("button", { name: "Controls" });
}

describe("GraphControls", () => {
  it("starts collapsed, with the gestures hidden", () => {
    render(<GraphControls />);

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByText("Highlight neighbors")).not.toBeVisible();
  });

  it("opens to list every canvas gesture beside what it does", async () => {
    const user = userEvent.setup();
    render(<GraphControls />);

    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    const gestures = screen
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(gestures).toEqual([
      "Click",
      "⌘/Ctrl+Click",
      "Click empty space",
      "Drag",
      "Scroll",
    ]);
    const actions = screen
      .getAllByRole("definition")
      .map((definition) => definition.textContent);
    expect(actions).toEqual([
      "Highlight neighbors",
      "Add or remove",
      "Clear selection",
      "Pan",
      "Zoom",
    ]);
  });

  it("points the button at the list it opens", async () => {
    const user = userEvent.setup();
    render(<GraphControls />);

    await user.click(toggle());

    const panelId = toggle().getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? "");
    expect(panel).toBeVisible();
    expect(within(panel as HTMLElement).getAllByRole("term")).toHaveLength(5);
  });

  it("collapses again on a second click", async () => {
    const user = userEvent.setup();
    render(<GraphControls />);

    await user.click(toggle());
    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Highlight neighbors")).not.toBeVisible();
  });

  it("collapses on Escape without leaving the button", async () => {
    const user = userEvent.setup();
    render(<GraphControls />);

    await user.click(toggle());
    await user.keyboard("{Escape}");

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveFocus();
  });
});
