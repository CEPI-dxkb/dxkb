import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { WorkspaceToolbar } from "../workspace-toolbar";

type ToolbarProps = ComponentProps<typeof WorkspaceToolbar>;

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    typeFilter: "all",
    onTypeFilterChange: vi.fn(),
    onRefresh: vi.fn(),
    isRefreshing: false,
    showHiddenFiles: false,
    onShowHiddenFilesChange: vi.fn(),
    onNewFolder: vi.fn(),
    onUpload: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceToolbar {...props} />);
  return props;
}

async function openActionsMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Workspace actions" }));
  return { user, menu: await screen.findByRole("menu") };
}

describe("WorkspaceToolbar", () => {
  it("names each action by its label, which folds out of sight in a narrow pane", () => {
    renderToolbar();

    // The label stays in the button (sr-only when folded), so the name holds.
    for (const name of ["Show hidden", "Refresh", "New Folder", "Upload"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("offers the same actions from the overflow menu", async () => {
    const props = renderToolbar();
    const { user, menu } = await openActionsMenu();

    await user.click(within(menu).getByRole("menuitem", { name: "New Folder" }));

    expect(props.onNewFolder).toHaveBeenCalledTimes(1);
  });

  it("toggles hidden files from a checkbox item in the menu", async () => {
    const props = renderToolbar({ showHiddenFiles: true });
    const { user, menu } = await openActionsMenu();

    const item = within(menu).getByRole("menuitemcheckbox", {
      name: "Show hidden",
    });
    expect(item).toHaveAttribute("aria-checked", "true");
    await user.click(item);

    expect(props.onShowHiddenFilesChange).toHaveBeenCalledWith(
      false,
      expect.anything(),
    );
  });

  it("disables write actions in the menu and says why", async () => {
    renderToolbar({ onNewFolder: undefined, onUpload: undefined });
    const { menu } = await openActionsMenu();

    expect(
      within(menu).getByText("You do not have write access in this directory"),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Upload" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows Refresh and New WS at the workspace root", async () => {
    const onNewWorkspace = vi.fn();
    renderToolbar({ isAtRoot: true, onNewWorkspace });

    expect(screen.getByRole("button", { name: "New WS" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Upload" }),
    ).not.toBeInTheDocument();

    const { user, menu } = await openActionsMenu();
    await user.click(within(menu).getByRole("menuitem", { name: "New WS" }));
    expect(onNewWorkspace).toHaveBeenCalledTimes(1);
  });
});
