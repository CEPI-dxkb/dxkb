import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { SelectionToGroupDialog } from "../selection-to-group-dialog";

vi.mock("../workspace-mini-browser", () => ({
  WorkspaceMiniBrowser: ({
    initialPath,
    onSelectPath,
  }: {
    initialPath: string;
    onSelectPath: (path: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelectPath(`${initialPath}/nested`);
      }}
    >
      Select Folder
    </button>
  ),
}));

vi.mock("../workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    id,
    preset,
    onSelectedObjectChange,
  }: {
    id?: string;
    preset?: string;
    onSelectedObjectChange?: (object: WorkspaceObject | null) => void;
  }) => (
    <button
      id={id}
      type="button"
      data-preset={preset}
      onClick={() =>
        onSelectedObjectChange?.({
          id: "group-1",
          name: "Existing Group",
          path: "/user/home/existing",
          type: "genome_group",
          isDirectory: false,
        })
      }
    >
      Select Existing Group
    </button>
  ),
}));

function renderDialog(
  overrides: Partial<ComponentProps<typeof SelectionToGroupDialog>> = {},
) {
  const props: ComponentProps<typeof SelectionToGroupDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    ids: ["1", "2"],
    defaultFolder: "/user/home",
    onCreate: vi.fn().mockResolvedValue(undefined),
    onAppend: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const { rerender } = render(<SelectionToGroupDialog {...props} />);
  return {
    ...props,
    /** Closes and reopens the dialog, which is what starts a new session. */
    reopen: () => {
      rerender(<SelectionToGroupDialog {...props} open={false} />);
      rerender(<SelectionToGroupDialog {...props} open />);
    },
  };
}

describe("SelectionToGroupDialog", () => {
  it("creates a group in the default folder with a sanitized name", async () => {
    const props = renderDialog();

    expect(screen.getByText("2 selected genomes")).toBeInTheDocument();
    expect(screen.getByLabelText("Folder path")).toHaveValue("/user/home");
    expect(screen.getByRole("button", { name: "Create Group" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "  Test\u0000 Group  " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create Group" }));

    expect(props.onCreate).toHaveBeenCalledWith("/user/home", "Test Group");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects names that would escape the selected folder", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Group name"), "bad/name");

    expect(
      screen.getByText("Group name cannot contain a slash."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Group" })).toBeDisabled();
  });

  it("appends to the selected genome group path", async () => {
    const props = renderDialog({ ids: ["1"] });

    await userEvent.click(screen.getByRole("tab", { name: "Existing Group" }));
    const selector = screen.getByLabelText("Genome group");
    expect(selector).toHaveAttribute("data-preset", "genomeGroup");
    expect(screen.getByRole("button", { name: "Add to Group" })).toBeDisabled();

    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("button", { name: "Add to Group" }));

    expect(props.onAppend).toHaveBeenCalledWith("/user/home/existing");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("targets Feature Groups for a feature selection", async () => {
    renderDialog({ ids: ["fig|83332.12.peg.1"], groupKind: "feature" });

    expect(screen.getByText("Add Features to Group")).toBeInTheDocument();
    expect(screen.getByText("1 selected feature")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Existing Group" }));
    expect(screen.getByLabelText("Feature group")).toHaveAttribute(
      "data-preset",
      "featureGroup",
    );
  });

  it("shows loading state and preserves callback errors", async () => {
    let rejectCreate: (error: Error) => void = () => undefined;
    const onCreate = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );
    const props = renderDialog({ onCreate });

    await userEvent.type(screen.getByLabelText("Group name"), "Test Group");
    await userEvent.click(screen.getByRole("button", { name: "Create Group" }));

    expect(
      screen.getByRole("button", { name: /Creating\.\.\./ }),
    ).toBeDisabled();
    rejectCreate(new Error("Group already exists"));

    expect(await screen.findByText("Group already exists")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create Group" }),
      ).toBeEnabled();
    });
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("disables submission when no genomes are selected", async () => {
    renderDialog({ ids: [] });

    await userEvent.type(screen.getByLabelText("Group name"), "Empty Group");

    expect(screen.getByText("0 selected genomes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Group" })).toBeDisabled();
  });

  describe("reopened dialog sessions", () => {
    it("ignores a create that resolves after the dialog was reopened", async () => {
      const create = Promise.withResolvers<undefined>();
      const props = renderDialog({ onCreate: vi.fn(() => create.promise) });

      await userEvent.type(screen.getByLabelText("Group name"), "Test Group");
      await userEvent.click(
        screen.getByRole("button", { name: "Create Group" }),
      );
      props.reopen();

      await act(async () => {
        create.resolve(undefined);
        await create.promise;
      });

      // Closing here would have dismissed whatever the user opened afterwards.
      expect(props.onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Create Group" })).toBeVisible();
    });

    it("ignores an append failure that arrives after the dialog was reopened", async () => {
      const append = Promise.withResolvers<undefined>();
      const props = renderDialog({
        ids: ["1"],
        onAppend: vi.fn(() => append.promise),
      });

      await userEvent.click(
        screen.getByRole("tab", { name: "Existing Group" }),
      );
      await userEvent.click(screen.getByLabelText("Genome group"));
      await userEvent.click(
        screen.getByRole("button", { name: "Add to Group" }),
      );
      props.reopen();

      // Pin what reopening produced: the popup is not kept mounted, so this is a
      // brand-new form back on the New Group tab — not the one that submitted.
      expect(screen.getByRole("tab", { name: "New Group" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("button", { name: "Create Group" })).toBeVisible();

      await act(async () => {
        append.reject(new Error("Group already exists"));
        await append.promise.catch(() => undefined);
      });

      // The new session is untouched by the old one's rejection, and still usable.
      expect(screen.queryByText("Group already exists")).toBeNull();
      expect(props.onOpenChange).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Group name"), {
        target: { value: "Second Try" },
      });
      await userEvent.click(
        screen.getByRole("button", { name: "Create Group" }),
      );
      expect(props.onCreate).toHaveBeenCalledWith("/user/home", "Second Try");
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
