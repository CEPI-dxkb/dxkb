import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionSelectionActions } from "../collection-selection-actions";
import { strainSelectionActionIds } from "../collection-selection-action-ids";

// The real action bar and the real Base UI dialogs, so focus moves the way it does
// in the app. Only what reaches past them (navigation, auth, the workspace and its
// object picker) is stubbed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/taxonomy/2955291",
  useSearchParams: () => new URLSearchParams("tab=strains"),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: { username: "alice", realm: "BVBRC" },
    isAuthenticated: true,
  }),
}));
vi.mock("@/contexts/workspace-repository-context", () => ({
  useWorkspaceRepository: () => ({
    createIdGroup: vi.fn(),
    appendToIdGroup: vi.fn(),
  }),
}));
vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({ id }: { id?: string }) => (
    <input id={id} readOnly />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * jsdom leaves focus on a button that turns disabled. Browsers apply the HTML focus
 * fixup rule and move it to the body, which is what a SERVICES or GROUP click does
 * while its IDs resolve, so the dialog that opens next finds nothing focused before
 * it. This emulates the rule. jsdom's `blur()` ignores an element that cannot take
 * focus, so the button is re-enabled for the blur and disabled again.
 */
function emulateFocusFixup() {
  const observer = new MutationObserver(() => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled) {
      active.disabled = false;
      active.blur();
      active.disabled = true;
    }
  });
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  return () => {
    observer.disconnect();
  };
}

let stopFocusFixup: () => void;
beforeEach(() => {
  stopFocusFixup = emulateFocusFixup();
});
afterEach(() => {
  stopFocusFixup();
});

/** Rows the test hands back once the action is visibly resolving. */
function heldRows() {
  let release: (rows: Record<string, unknown>[]) => void = () => undefined;
  const resolveActionRows = vi.fn(
    () =>
      new Promise<Record<string, unknown>[]>((resolve) => {
        release = resolve;
      }),
  );
  return {
    resolveActionRows,
    release: (rows: Record<string, unknown>[]) => {
      release(rows);
    },
  };
}

function renderStrainActions(
  resolveActionRows: (
    fields: readonly string[],
  ) => Promise<Record<string, unknown>[]>,
) {
  render(
    <CollectionSelectionActions
      searchType="strain"
      label="Strains"
      actionIds={strainSelectionActionIds}
      idField="genome_ids"
      selectedCount={2}
      columns={[{ id: "strain", label: "Strain" }]}
      columnVisibility={{ strain: true }}
      resolveActionRows={resolveActionRows}
      onError={vi.fn()}
    />,
  );
}

describe("CollectionSelectionActions dialog focus", () => {
  it.each([
    { action: /^group$/i, dialog: "Add Genomes to Group" },
    { action: /^services$/i, dialog: "Use selected Strains in a service" },
  ])(
    "hands focus back to $action when Escape closes $dialog",
    async ({ action, dialog }) => {
      const user = userEvent.setup();
      const rows = heldRows();
      renderStrainActions(rows.resolveActionRows);
      const trigger = screen.getByRole("button", { name: action });

      await user.click(trigger);
      // Disabled while the IDs resolve, so focus has dropped to the body.
      expect(trigger).toBeDisabled();
      await waitFor(() => {
        expect(document.body).toHaveFocus();
      });

      await act(async () => {
        rows.release([{ genome_ids: ["1.1", "1.2"] }]);
        await Promise.resolve();
      });
      expect(
        await screen.findByRole("dialog", { name: dialog }),
      ).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    },
  );

  it("hands focus back to GROUP when a created group closes the dialog", async () => {
    const user = userEvent.setup();
    const rows = heldRows();
    renderStrainActions(rows.resolveActionRows);
    const group = screen.getByRole("button", { name: /^group$/i });

    await user.click(group);
    await act(async () => {
      rows.release([{ genome_ids: ["1.1"] }]);
      await Promise.resolve();
    });
    await user.type(
      await screen.findByRole("textbox", { name: "Group name" }),
      "New Group",
    );
    await user.click(screen.getByRole("button", { name: "Create Group" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(group).toHaveFocus();
    });
  });

  it("hands focus back to COPY even when the click did not focus it", async () => {
    // WebKit does not focus a button on click, so the dialog finds the body (or an
    // earlier control) focused when it opens.
    const user = userEvent.setup();
    renderStrainActions(vi.fn(() => Promise.resolve([])));
    const copy = screen.getByRole("button", { name: /^copy$/i });

    fireEvent.click(copy);
    expect(
      await screen.findByRole("dialog", { name: "Copy selected Strains (2)" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(copy).toHaveFocus();
    });
  });
});
