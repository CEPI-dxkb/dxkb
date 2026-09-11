import { act, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Clipboard permission denied",
    );
  });

  it("clears a previous error when the dialog is reopened", async () => {
    const onOpenChange = vi.fn();
    const onCopy = vi.fn().mockRejectedValue(new Error("Copy failed"));
    const { rerender } = render(
      <CollectionCopyDialog
        open
        onOpenChange={onOpenChange}
        label="Strains"
        selectedCount={1}
        onCopy={onCopy}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    const props = {
      onOpenChange,
      label: "Strains",
      selectedCount: 1,
      onCopy,
    };
    rerender(<CollectionCopyDialog open={false} {...props} />);
    rerender(<CollectionCopyDialog open {...props} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a copy that resolves after the dialog was closed and reopened", async () => {
    const onOpenChange = vi.fn();
    let resolveCopy: (() => void) | undefined;
    const onCopy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    const props = {
      onOpenChange,
      label: "Strains",
      selectedCount: 1,
      onCopy,
    };
    const { rerender } = render(<CollectionCopyDialog open {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    );
    expect(
      screen.getByRole("button", { name: "Copying..." }),
    ).toBeInTheDocument();

    rerender(<CollectionCopyDialog open={false} {...props} />);
    rerender(<CollectionCopyDialog open {...props} />);

    // The reopened session is idle, not stuck in the previous "Copying..." state.
    expect(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    ).toBeEnabled();

    await act(() => {
      resolveCopy?.();
      return Promise.resolve();
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    ).toBeEnabled();
  });

  it("ignores a copy that rejects after the dialog was closed and reopened", async () => {
    const onOpenChange = vi.fn();
    let rejectCopy: ((reason: Error) => void) | undefined;
    const onCopy = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCopy = reject;
        }),
    );
    const props = {
      onOpenChange,
      label: "Strains",
      selectedCount: 1,
      onCopy,
    };
    const { rerender } = render(<CollectionCopyDialog open {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    );
    rerender(<CollectionCopyDialog open={false} {...props} />);
    rerender(<CollectionCopyDialog open {...props} />);

    await act(() => {
      rejectCopy?.(new Error("Stale failure"));
      return Promise.resolve();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows a fresh copy after a stale operation was discarded", async () => {
    const onOpenChange = vi.fn();
    const pending: (() => void)[] = [];
    const onCopy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );
    const props = {
      onOpenChange,
      label: "Strains",
      selectedCount: 1,
      onCopy,
    };
    const { rerender } = render(<CollectionCopyDialog open {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "All Columns (with headers)" }),
    );
    rerender(<CollectionCopyDialog open={false} {...props} />);
    rerender(<CollectionCopyDialog open {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Selected Columns (with headers)" }),
    );
    await act(() => {
      pending.forEach((resolve) => {
        resolve();
      });
      return Promise.resolve();
    });

    expect(onCopy).toHaveBeenLastCalledWith("visible", true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
