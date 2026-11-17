import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { FolderPickerToolbar } from "@/components/workspace/folder-picker/folder-picker-toolbar";
import { settleBackgroundWork } from "@/test-helpers/settle";

type Props = ComponentProps<typeof FolderPickerToolbar>;

function renderToolbar(overrides: Partial<Props> = {}) {
  const props: Props = {
    showNewFolder: true,
    unavailableReason: null,
    onNewFolder: vi.fn(),
    onUpload: vi.fn(),
    ...overrides,
  };
  render(<FolderPickerToolbar {...props} />);
  return props;
}

describe("FolderPickerToolbar", () => {
  it("offers New folder and Upload as a labelled group, New folder first", () => {
    renderToolbar();

    const group = screen.getByRole("group", { name: "Folder actions" });
    const names = Array.from(group.querySelectorAll("button")).map(
      (button) => button.textContent,
    );
    expect(names).toEqual(["New folder here", "Upload here"]);
  });

  it("calls the handlers when the actions are available", async () => {
    const user = userEvent.setup();
    const { onNewFolder, onUpload } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "New folder here" }));
    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(onNewFolder).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("omits New folder when picking files, but keeps Upload", () => {
    renderToolbar({ showNewFolder: false });

    expect(
      screen.queryByRole("button", { name: "New folder here" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeEnabled();
  });

  it("disables both actions while a reason is given, and calls nothing", async () => {
    const user = userEvent.setup();
    const { onNewFolder, onUpload } = renderToolbar({
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
    renderToolbar({ unavailableReason: "Open a folder first." });

    await user.hover(
      screen.getByRole("button", { name: "Upload here" })
        .parentElement as HTMLElement,
    );

    expect(
      await screen.findByText("Upload here: Open a folder first."),
    ).toBeInTheDocument();
  });

  it("shows no tooltip when an action is available", async () => {
    const user = userEvent.setup();
    renderToolbar({ unavailableReason: null });

    await user.hover(screen.getByRole("button", { name: "Upload here" }));
    await settleBackgroundWork();

    expect(screen.queryByText(/^Upload here:/)).not.toBeInTheDocument();
  });
});
