import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SelectionToGroupDialog } from "../selection-to-group-dialog";
import {
  findOption,
  pickerHome,
  pickerRepositoryWrapper,
  pickerUser,
  selectButton,
  stubPickerBrowserApis,
} from "../folder-picker/__tests__/fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: vi.fn(() => ({ user: pickerUser })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  stubPickerBrowserApis();
});

function place(name: string) {
  return within(screen.getByRole("navigation", { name: "Places" })).getByRole(
    "button",
    { name },
  );
}

describe("SelectionToGroupDialog browse", () => {
  it("stacks the folder suggestions above the dialog and picks from them", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <SelectionToGroupDialog
        open
        onOpenChange={vi.fn()}
        ids={["1"]}
        defaultFolder={pickerHome}
        onCreate={onCreate}
        onAppend={vi.fn().mockResolvedValue(undefined)}
      />,
      { wrapper: pickerRepositoryWrapper() },
    );

    const folderField = screen.getByLabelText("Folder");
    await user.clear(folderField);
    await user.type(folderField, "Exp");
    const listbox = await screen.findByRole("listbox");
    const option = await within(listbox).findByRole("option", {
      name: /Experiments/,
    });

    // jsdom does not paint, so compare what decides the paint order: the
    // suggestions (portaled to <body>) must sit on the dialog's z-index tier
    // or higher, and come after the dialog so they win a tie.
    const dialog = screen.getByRole("dialog", { name: "Add Genomes to Group" });
    const zIndex = (element: Element) =>
      Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec(element.className)?.[1] ?? 0);
    expect(zIndex(listbox)).toBeGreaterThanOrEqual(zIndex(dialog));
    expect(zIndex(dialog)).toBeGreaterThan(0);
    expect(
      dialog.compareDocumentPosition(listbox) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(option);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(folderField).toHaveValue("Experiments");

    await user.type(screen.getByLabelText("Group name"), "Picked Group");
    await user.click(screen.getByRole("button", { name: "Create Group" }));
    expect(onCreate).toHaveBeenCalledWith(
      `${pickerHome}/Experiments`,
      "Picked Group",
    );
  });

  it("creates a new group in a workspace other than Home", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <SelectionToGroupDialog
        open
        onOpenChange={vi.fn()}
        ids={["1"]}
        defaultFolder={pickerHome}
        onCreate={onCreate}
        onAppend={vi.fn().mockResolvedValue(undefined)}
      />,
      { wrapper: pickerRepositoryWrapper() },
    );

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );
    const pickerName = "Select an Output Folder for This New Group";
    expect(
      await screen.findByRole("dialog", { name: pickerName }),
    ).toBeInTheDocument();
    await user.click(place("Shared Workspaces"));
    await user.click(await findOption("Shared Workspaces", /shared-ws/));
    await user.click(selectButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: pickerName })).toBeNull();
    });
    expect(screen.getByLabelText("Folder")).toHaveValue("shared-ws");

    await user.type(screen.getByLabelText("Group name"), "Shared Group");
    await user.click(screen.getByRole("button", { name: "Create Group" }));

    expect(onCreate).toHaveBeenCalledWith(
      "/bob@bvbrc/shared-ws",
      "Shared Group",
    );
  });

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
