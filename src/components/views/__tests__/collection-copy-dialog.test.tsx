import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionCopyDialog } from "../collection-copy-dialog";

const choices = [
  ["All Columns (with headers)", "all", true],
  ["All Columns (without headers)", "all", false],
  ["Selected Columns (with headers)", "visible", true],
  ["Selected Columns (without headers)", "visible", false],
] as const;

describe("CollectionCopyDialog", () => {
  it.each(choices)(
    "maps %s to the copy callback",
    async (label, mode, headers) => {
      const onCopy = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();
      render(
        <CollectionCopyDialog
          open
          onOpenChange={onOpenChange}
          label="Strains"
          selectedCount={2}
          onCopy={onCopy}
        />,
      );

      expect(screen.getByText("Copy selected Strains (2)")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: label }));

      expect(onCopy).toHaveBeenCalledWith(mode, headers);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    },
  );

  it("keeps the dialog open and displays the original copy error", async () => {
    const onOpenChange = vi.fn();
    render(
      <CollectionCopyDialog
        open
        onOpenChange={onOpenChange}
        label="Strains"
        selectedCount={1}
        onCopy={vi
          .fn()
          .mockRejectedValue(new Error("Clipboard permission denied"))}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    );

    expect(
      await screen.findByText("Clipboard permission denied"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
