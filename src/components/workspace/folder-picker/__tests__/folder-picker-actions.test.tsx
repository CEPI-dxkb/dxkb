import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { FolderPickerActions } from "@/components/workspace/folder-picker/folder-picker-actions";
import { settleBackgroundWork } from "@/test-helpers/settle";

type Props = ComponentProps<typeof FolderPickerActions>;

function renderActions(overrides: Partial<Props> = {}) {
  const props: Props = {
    showNewFolder: true,
    unavailableReason: null,
    onNewFolder: vi.fn(),
    onUpload: vi.fn(),
    showFiles: false,
    onShowFilesChange: vi.fn(),
    isPickingFiles: false,
    ...overrides,
  };
  render(<FolderPickerActions {...props} />);
  return props;
}

describe("FolderPickerActions", () => {
  it("offers New folder, Upload and Show files as a labelled group, in that order", () => {
    renderActions();

    const group = screen.getByRole("group", { name: "Folder actions" });
    const names = Array.from(group.querySelectorAll("button")).map(
      (button) => button.textContent,
    );
    expect(names).toEqual(["New folder here", "Upload here", "Show files"]);
  });

  it("tints New folder and Upload so they stand out, and leaves the toggle outlined", () => {
    renderActions();

    expect(
      screen.getByRole("button", { name: "New folder here" }),
    ).toHaveAttribute("data-variant", "soft");
    expect(screen.getByRole("button", { name: "Upload here" })).toHaveAttribute(
      "data-variant",
      "soft",
    );
    expect(screen.getByRole("button", { name: "Show files" })).toHaveAttribute(
      "data-variant",
      "outline",
    );
  });

  it("fills the pane's width with every button, tooltip wrappers included", () => {
    renderActions();

    for (const name of ["New folder here", "Upload here"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("w-full");
      expect(button.parentElement).toHaveClass("flex", "w-full");
    }
    expect(screen.getByRole("button", { name: "Show files" })).toHaveClass(
      "w-full",
    );
  });

  it("lets only the toggle span the row while New folder and Upload share it", () => {
    renderActions();
    expect(
      screen.getByRole("button", { name: "Upload here" }).parentElement,
    ).not.toHaveClass("col-span-full");
    expect(
      screen.getByRole("button", { name: "New folder here" }).parentElement,
    ).not.toHaveClass("col-span-full");
    expect(screen.getByRole("button", { name: "Show files" })).toHaveClass(
      "col-span-full",
    );
  });

  it("calls the handlers when the actions are available", async () => {
    const user = userEvent.setup();
    const { onNewFolder, onUpload } = renderActions();

    await user.click(screen.getByRole("button", { name: "New folder here" }));
    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(onNewFolder).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("omits New folder when picking files, but keeps Upload and the toggle", () => {
    renderActions({ showNewFolder: false, isPickingFiles: true });

    expect(
      screen.queryByRole("button", { name: "New folder here" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Show other files" }),
    ).toBeEnabled();
  });

  it("shows Upload alone, spanning the row, when picking files", () => {
    renderActions({ showNewFolder: false, isPickingFiles: true });

    const group = screen.getByRole("group", { name: "Folder actions" });
    const names = Array.from(group.querySelectorAll("button")).map(
      (button) => button.textContent,
    );
    expect(names).toEqual(["Upload here", "Show other files"]);
    expect(
      screen.getByRole("button", { name: "Upload here" }).parentElement,
    ).toHaveClass("col-span-full");
  });

  it("disables both actions while a reason is given, and calls nothing", async () => {
    const user = userEvent.setup();
    const { onNewFolder, onUpload } = renderActions({
      unavailableReason: "Open a folder first.",
    });

    const newFolder = screen.getByRole("button", { name: "New folder here" });
    const upload = screen.getByRole("button", { name: "Upload here" });
    expect(newFolder).toBeDisabled();
    expect(upload).toBeDisabled();

    await user.click(newFolder);
    await user.click(upload);
    expect(onNewFolder).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("shows the reason in a tooltip when a disabled action's wrapper is hovered", async () => {
    const user = userEvent.setup();
    renderActions({ unavailableReason: "Open a folder first." });

    await user.hover(
      screen.getByRole("button", { name: "Upload here" })
        .parentElement as HTMLElement,
    );

    expect(
      await screen.findByText("Upload here: Open a folder first."),
    ).toBeInTheDocument();
  });

  it("opens each reason tooltip from the keyboard while the actions are unavailable", async () => {
    const user = userEvent.setup();
    renderActions({ unavailableReason: "Open a folder first." });

    await user.tab();
    expect(
      await screen.findByText("New folder here: Open a folder first."),
    ).toBeInTheDocument();

    await user.tab();
    expect(
      await screen.findByText("Upload here: Open a folder first."),
    ).toBeInTheDocument();
  });

  it("adds no extra tab stop when the actions are available", async () => {
    const user = userEvent.setup();
    renderActions({ unavailableReason: null });

    await user.tab();

    expect(
      screen.getByRole("button", { name: "New folder here" }),
    ).toHaveFocus();
  });

  it("shows no tooltip when an action is available", async () => {
    const user = userEvent.setup();
    renderActions({ unavailableReason: null });

    await user.hover(screen.getByRole("button", { name: "Upload here" }));
    await settleBackgroundWork();

    expect(screen.queryByText(/^Upload here:/)).not.toBeInTheDocument();
  });

  describe("Show files toggle", () => {
    it.each([
      { isPickingFiles: false, off: "Show files", on: "Hide files" },
      { isPickingFiles: true, off: "Show other files", on: "Hide other files" },
    ])(
      "is labelled $off / $on when isPickingFiles is $isPickingFiles",
      ({ isPickingFiles, off, on }) => {
        const { unmount } = render(
          <FolderPickerActions
            showNewFolder={!isPickingFiles}
            unavailableReason={null}
            onNewFolder={vi.fn()}
            onUpload={vi.fn()}
            showFiles={false}
            onShowFilesChange={vi.fn()}
            isPickingFiles={isPickingFiles}
          />,
        );
        expect(
          screen.getByRole("button", { name: off, pressed: false }),
        ).toBeInTheDocument();
        unmount();

        render(
          <FolderPickerActions
            showNewFolder={!isPickingFiles}
            unavailableReason={null}
            onNewFolder={vi.fn()}
            onUpload={vi.fn()}
            showFiles
            onShowFilesChange={vi.fn()}
            isPickingFiles={isPickingFiles}
          />,
        );
        expect(
          screen.getByRole("button", { name: on, pressed: true }),
        ).toBeInTheDocument();
      },
    );

    it("swaps the eye icon with the state", () => {
      const { unmount } = render(
        <FolderPickerActions
          showNewFolder
          unavailableReason={null}
          onNewFolder={vi.fn()}
          onUpload={vi.fn()}
          showFiles={false}
          onShowFilesChange={vi.fn()}
          isPickingFiles={false}
        />,
      );
      expect(
        screen
          .getByRole("button", { name: "Show files" })
          .querySelector("svg.lucide-eye"),
      ).toBeInTheDocument();
      unmount();

      renderActions({ showFiles: true });
      expect(
        screen
          .getByRole("button", { name: "Hide files" })
          .querySelector("svg.lucide-eye-off"),
      ).toBeInTheDocument();
    });

    it("asks to show files when they are hidden", async () => {
      const user = userEvent.setup();
      const { onShowFilesChange } = renderActions({ showFiles: false });

      await user.click(screen.getByRole("button", { name: "Show files" }));

      expect(onShowFilesChange).toHaveBeenCalledTimes(1);
      expect(onShowFilesChange).toHaveBeenCalledWith(true);
    });

    it("asks to hide files when they are shown", async () => {
      const user = userEvent.setup();
      const { onShowFilesChange } = renderActions({ showFiles: true });

      await user.click(screen.getByRole("button", { name: "Hide files" }));

      expect(onShowFilesChange).toHaveBeenCalledTimes(1);
      expect(onShowFilesChange).toHaveBeenCalledWith(false);
    });

    it("stays enabled and usable while a reason turns the other two off", async () => {
      const user = userEvent.setup();
      const { onShowFilesChange } = renderActions({
        unavailableReason: "Open a folder first.",
      });

      expect(
        screen.getByRole("button", { name: "New folder here" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Upload here" })).toBeDisabled();
      const toggle = screen.getByRole("button", { name: "Show files" });
      expect(toggle).toBeEnabled();

      await user.click(toggle);
      expect(onShowFilesChange).toHaveBeenCalledWith(true);
    });
  });
});
