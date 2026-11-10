import { render, screen } from "@testing-library/react";
import { CommandDialog } from "../command";

describe("CommandDialog", () => {
  it("keeps the title that names the dialog inside the popup, visible to assistive tech", async () => {
    render(
      <CommandDialog open>
        <p>Results</p>
      </CommandDialog>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Command Palette" });
    const title = screen.getByText("Command Palette");
    // Base UI marks everything outside a modal popup aria-hidden, so a title
    // beside the popup would name the dialog from hidden content.
    expect(dialog).toContainElement(title);
    expect(title.closest("[aria-hidden='true']")).toBeNull();
  });
});
