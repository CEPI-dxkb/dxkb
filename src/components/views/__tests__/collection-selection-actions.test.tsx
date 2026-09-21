import type { ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  selectionServicesMaxIds,
  selectionServicesMaxRows,
} from "@/lib/views/collection-selection";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
    createFolder: vi.fn(),
    createIdGroup: vi.fn(),
    appendToIdGroup: vi.fn(),
  }),
}));
vi.mock("../collection-copy-dialog", () => ({
  CollectionCopyDialog: () => null,
}));
vi.mock("../selection-service-chooser", () => ({
  SelectionServiceChooser: ({
    open,
    ids,
  }: {
    open: boolean;
    ids: readonly string[];
  }) =>
    open ? <div data-testid="selection-services">{ids.join(",")}</div> : null,
}));
vi.mock("@/components/workspace/selection-to-group-dialog", () => ({
  SelectionToGroupDialog: ({
    open,
    ids,
  }: {
    open: boolean;
    ids: readonly string[];
  }) =>
    open ? <div data-testid="selection-group">{ids.join(",")}</div> : null,
}));

import { CollectionSelectionActions } from "../collection-selection-actions";

const actionIds = ["copyRows", "services", "genomes", "group"] as const;

/** Strain is the interesting shape: one row's `genome_ids` fans out to many IDs. */
function renderStrainActions(
  overrides: Partial<ComponentProps<typeof CollectionSelectionActions>>,
) {
  render(
    <CollectionSelectionActions
      searchType="strain"
      label="Strains"
      actionIds={actionIds}
      idField="genome_ids"
      selectedCount={2}
      columns={[{ id: "strain", label: "Strain" }]}
      columnVisibility={{ strain: true }}
      resolveActionRows={vi.fn(() => Promise.resolve([]))}
      onError={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CollectionSelectionActions", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("rejects a second selection action while the first is still resolving", async () => {
    const user = userEvent.setup();
    let resolveRows: ((rows: Record<string, unknown>[]) => void) | undefined;
    const resolveActionRows = vi.fn(
      () =>
        new Promise<Record<string, unknown>[]>((resolve) => {
          resolveRows = resolve;
        }),
    );
    const onError = vi.fn();
    renderStrainActions({ resolveActionRows, onError });

    await user.click(screen.getByRole("button", { name: /^services$/i }));

    // SERVICES owns the single shared ID slot until it settles, so every other owned
    // action is disabled and a GROUP click in the meantime never starts a fetch.
    const groupButton = screen.getByRole("button", { name: /^group$/i });
    expect(groupButton).toBeDisabled();
    await user.click(groupButton);
    expect(resolveActionRows).toHaveBeenCalledTimes(1);
    expect(resolveActionRows).toHaveBeenCalledWith(
      ["genome_ids"],
      selectionServicesMaxRows,
      "Services",
    );

    await act(async () => {
      resolveRows?.([{ genome_ids: ["11320.1", "11320.2"] }]);
      await Promise.resolve();
    });

    // Only the winning action's dialog opens, with only its own IDs.
    expect(await screen.findByTestId("selection-services")).toHaveTextContent(
      "11320.1,11320.2",
    );
    expect(screen.queryByTestId("selection-group")).not.toBeInTheDocument();
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("re-enables the other actions once the pending one settles", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    renderStrainActions({
      resolveActionRows: vi.fn(() =>
        Promise.resolve([{ genome_ids: ["11320.1"] }]),
      ),
      onError,
    });

    await user.click(screen.getByRole("button", { name: /^services$/i }));
    await screen.findByTestId("selection-services");

    await user.click(screen.getByRole("button", { name: /^group$/i }));
    expect(await screen.findByTestId("selection-group")).toHaveTextContent(
      "11320.1",
    );
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("rejects a selection whose rows flatten past the services ID ceiling", async () => {
    const user = userEvent.setup();
    // 20 rows is well inside the 100-row fetch bound, but each segmented Strain row
    // carries 40 genomes, so the selection resolves to 800 genome IDs.
    const rows = Array.from({ length: 20 }, (_, row) => ({
      genome_ids: Array.from(
        { length: 40 },
        (_, segment) => `1132${String(row)}.${String(segment)}`,
      ),
    }));
    const onError = vi.fn();
    renderStrainActions({
      selectedCount: rows.length,
      resolveActionRows: vi.fn(() => Promise.resolve(rows)),
      onError,
    });

    await user.click(screen.getByRole("button", { name: /^services$/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        `This selection resolves to 800 genome IDs; Services supports at most ${selectionServicesMaxIds.toLocaleString()}. Narrow the selection and try again.`,
      );
    });
    expect(screen.queryByTestId("selection-services")).not.toBeInTheDocument();
  });

  it("opens the Genome list when the flattened IDs stay under the list ceiling", async () => {
    const user = userEvent.setup();
    renderStrainActions({
      resolveActionRows: vi.fn(() =>
        Promise.resolve([{ genome_ids: ["11320.1", "11320.2"] }]),
      ),
    });

    await user.click(screen.getByRole("button", { name: /^ggenomes$/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/genome?rql=in(genome_id%2C(11320.1%2C11320.2))",
      );
    });
  });

  it("preserves the list URL validation error and releases the pending action", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const longIds = Array.from(
      { length: 100 },
      (_, index) => `${String(index)}.${"x".repeat(90)}`,
    );
    renderStrainActions({
      resolveActionRows: vi.fn(() =>
        Promise.resolve([{ genome_ids: longIds }]),
      ),
      onError,
    });

    await user.click(screen.getByRole("button", { name: /^ggenomes$/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
      );
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^services$/i })).toBeEnabled();
  });
});
