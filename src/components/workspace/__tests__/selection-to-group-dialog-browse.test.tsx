import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SelectionToGroupDialog } from "../selection-to-group-dialog";
import {
  pickerRepositoryWrapper,
  pickerUser,
  stubPickerBrowserApis,
} from "../folder-picker/__tests__/fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: vi.fn(() => ({ user: pickerUser })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// The "New Group" tab's folder browser is out of scope here.
vi.mock("../workspace-mini-browser", () => ({
  WorkspaceMiniBrowser: () => null,
}));

beforeEach(() => {
  stubPickerBrowserApis();
});

describe("SelectionToGroupDialog browse", () => {
  it("Escape in the picker closes only the picker, not the group dialog", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SelectionToGroupDialog
        open
        onOpenChange={onOpenChange}
        ids={["1"]}
        defaultFolder="/user/home"
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onAppend={vi.fn().mockResolvedValue(undefined)}
      />,
      { wrapper: pickerRepositoryWrapper() },
    );
    await user.click(screen.getByRole("tab", { name: "Existing Group" }));
    await user.click(
      screen.getByRole("button", { name: "Browse workspace files" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Select a Genome Group" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Select a Genome Group" }),
      ).toBeNull();
    });
    // `open` is fixed, so the group dialog only shows it was asked to close
    // through this callback.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Add Genomes to Group" }),
    ).toBeInTheDocument();
  });
});
