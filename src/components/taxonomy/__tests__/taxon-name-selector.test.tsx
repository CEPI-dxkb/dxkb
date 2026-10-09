import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { createQueryClientWrapper } from "@/test-helpers/react";

// `value` is always passed: the selector syncs `prevValue` (null) against the
// prop during render, so an omitted (undefined) value never settles.
describe("TaxonNameSelector invalid", () => {
  it("draws the error border for a caller-reported failure without adding a message", () => {
    render(<TaxonNameSelector value={null} invalid />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");
    expect(screen.queryByText("Taxonomy Name must be provided.")).toBeNull();
  });

  it("keeps the default border until the required field is touched", async () => {
    const user = userEvent.setup();
    render(<TaxonNameSelector value={null} required />, {
      wrapper: createQueryClientWrapper(),
    });
    const input = screen.getByRole("textbox");

    expect(input).not.toHaveClass("border-destructive");

    await user.click(input);
    await user.tab();

    expect(input).toHaveClass("border-destructive");
    expect(screen.getByText("Taxonomy Name must be provided.")).toBeVisible();
  });
});
