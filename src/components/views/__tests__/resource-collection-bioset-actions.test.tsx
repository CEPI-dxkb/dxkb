import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { biosetCollectionProfile } from "@/lib/experiment-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

// Bioset is the other resource (with Taxonomy) whose action needs a network
// round-trip before it can navigate: BIOSETS pools every selected row's experiment
// IDs, which for an all-pages selection means resolving them after a tab is already
// reserved. That reservation/race/error-recovery shape is exercised on its own here
// rather than folded into the shared selection-action tests.

const { useResourceCollection } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));
let actionBarProps: Record<string, unknown>;
let dataTableProps: Record<string, unknown>;

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
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));
vi.mock("@/contexts/workspace-repository-context", () => ({
  useWorkspaceRepository: () => ({
    createIdGroup: vi.fn(),
    appendToIdGroup: vi.fn(),
  }),
}));
vi.mock("../collection-copy-dialog", () => ({
  CollectionCopyDialog: () => null,
}));
vi.mock("../selection-service-chooser", () => ({
  SelectionServiceChooser: () => null,
}));
vi.mock("@/components/workspace/selection-to-group-dialog", () => ({
  SelectionToGroupDialog: () => null,
}));
vi.mock("../resource-export", () => ({
  downloadResourceExport: vi.fn(),
  serializeResourceRows: vi.fn(),
}));
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("../resource-filter-bar", () => ({
  ResourceFilterBar: (props: Record<string, unknown>) => (
    <div
      data-testid="filter-bar"
      data-definitions={JSON.stringify(props.definitions)}
      data-keyword={typeof props.keyword === "string" ? props.keyword : ""}
    />
  ),
}));
// Plan item 21: shared with every resource-collection*.test.tsx suite so the
// enabledActions/disabledActions gating logic (a real behavioral contract mirroring
// search-action-bar.tsx's actionConfig) lives in one place. See the fixture's own
// doc comment for what it does and does not model.
vi.mock("@/components/search/search-action-bar", async () => {
  // A dynamic import, not a static one: `vi.mock` factories run before the file's own
  // static imports are linked, so a statically-imported helper referenced here throws
  // ("Cannot access ... before initialization"). Awaiting the import inside the
  // factory sidesteps that — `beforeEach`/the tests below still resolve normally.
  const { createSearchActionBarFake } = await import(
    "./fixtures/search-action-bar-fake"
  );
  return {
    SearchActionBar: createSearchActionBarFake(
      (props: Record<string, unknown>) => {
        actionBarProps = props;
      },
    ),
  };
});
vi.mock("@/components/detail-panel/info-panel", () => ({
  InfoPanel: ({
    selectedRow,
  }: {
    selectedRow: Record<string, unknown> | null;
  }) => (
    <div data-testid="detail">
      {selectedRow ? String(selectedRow.genome_name) : null}
    </div>
  ),
}));
vi.mock("../taxonomy-service-chooser", () => ({
  TaxonomyServiceChooser: () => null,
}));
vi.mock("../resource-workspace", () => ({
  ResourceWorkspace: ({
    children,
    actionBar,
    sidePanel,
  }: {
    children: ReactNode;
    actionBar: ReactNode;
    sidePanel: ReactNode;
  }) => (
    <div>
      {actionBar}
      {children}
      {sidePanel}
    </div>
  ),
}));
vi.mock("@/components/shared/data-table", () => ({
  DataTable: (props: Record<string, unknown>) => {
    dataTableProps = props;
    return <div data-testid="data-table" />;
  },
}));

function collectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
) {
  return createResourceCollectionResult(overrides);
}

function repository(
  exportResult: Promise<unknown> = Promise.resolve({ rows: [] }),
) {
  return {
    exportAll: vi.fn(() => exportResult),
    selected: vi.fn(() => exportResult),
  } as unknown as DataRepository;
}

beforeEach(() => {
  useResourceCollection.mockReturnValue(collectionResult());
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection Bioset actions", () => {
  it("supports legacy Bioset sidebar actions", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    const open = vi.fn(() => ({ opener: window, location: { replace } }));
    vi.stubGlobal("open", open);
    const selected = vi.fn((resource, request: { fields: string[] }) =>
      Promise.resolve({
        rows: request.fields.includes("exp_id") ? [{ exp_id: "00042" }] : [],
      }),
    );
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "bioset-1",
      detail: { bioset_id: "bioset-1", exp_id: "00042" },
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: { "bioset-1": true },
      selectedIds: ["bioset-1"],
    });

    render(
      <ResourceCollection
        profile={{
          resource: "bioset",
          label: "Biosets",
          idField: "bioset_id",
          columns: [{ id: "bioset_id", label: "Bioset ID" }],
          defaultSort: "bioset_id:asc",
          guideUrl: "https://example.test/guide",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["services", "biosets"],
      guideUrl: "https://example.test/guide",
    });
    await user.click(screen.getByRole("button", { name: "Download action" }));
    expect(selected).toHaveBeenCalledWith("bioset", {
      ids: ["bioset-1"],
      fields: ["bioset_id"],
    });
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(selected).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042))",
      "_blank",
      "noopener,noreferrer",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the Biosets action disabled rather than letting it dispatch when any selected Bioset lacks an experiment", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "bioset-1",
      detail: { bioset_id: "bioset-1", exp_id: "00042" },
      rows: [
        { bioset_id: "bioset-1", exp_id: "00042" },
        { bioset_id: "bioset-2" },
      ],
      selection: { "bioset-1": true, "bioset-2": true },
      selectedIds: ["bioset-1", "bioset-2"],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["services", "biosets"],
      disabledActions: {
        biosets: "Some selected Biosets are not associated with experiments",
      },
    });
    // Plan item 21: the real bar disables rather than removes this button
    // (search-action-bar.tsx's `isDisabled`), so the fake renders it the same way —
    // present, with the native `disabled` attribute. Asserting `toBeDisabled()` proves
    // BIOSETS is genuinely unreachable in the real UI's own terms; the click below
    // (which a disabled `<button>` never dispatches) and the `open` assertion confirm
    // it, rather than merely proving a click happened to have no effect.
    const biosetsButton = screen.getByRole("button", { name: "Biosets action" });
    expect(biosetsButton).toBeDisabled();
    await user.click(biosetsButton);
    expect(open).not.toHaveBeenCalled();
  });

  it("resolves Bioset experiment IDs retained across pages", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const selected = vi.fn();
    const profile = {
      resource: "bioset" as const,
      label: "Biosets",
      idField: "bioset_id",
      columns: [{ id: "bioset_id", label: "Bioset ID" }],
      defaultSort: "bioset_id:asc",
    };
    let currentCollection = {
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {} as Record<string, true>,
      selectedIds: [] as string[],
      total: 2,
    };
    useResourceCollection.mockImplementation(() => currentCollection);

    const view = render(
      <ResourceCollection
        profile={profile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );
    act(() => {
      (
        dataTableProps.onRowSelectionChange as (
          selection: Record<string, boolean>,
        ) => void
      )({
        "bioset-1": true,
      });
    });

    currentCollection = {
      ...currentCollection,
      rows: [{ bioset_id: "bioset-2", exp_id: "00051" }],
      selection: { "bioset-1": true, "bioset-2": true },
      selectedIds: ["bioset-1", "bioset-2"],
    };
    view.rerender(
      <ResourceCollection
        profile={profile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 2, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );
    act(() => {
      (
        dataTableProps.onRowSelectionChange as (
          selection: Record<string, boolean>,
        ) => void
      )({
        "bioset-1": true,
        "bioset-2": true,
      });
    });

    expect(actionBarProps).toMatchObject({
      enabledActions: ["services", "biosets"],
    });
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(selected).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,00051))",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("resolves all matching Bioset experiment IDs", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    const open = vi.fn(() => ({ opener: window, location: { replace } }));
    vi.stubGlobal("open", open);
    const exportAll = vi.fn(() =>
      Promise.resolve({ rows: [{ exp_id: "00042" }, { exp_id: "00051" }] }),
    );
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      isAllPagesSelected: true,
      rows: [{ bioset_id: "bioset-2", exp_id: "00051" }],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll } as unknown as DataRepository}
        state={{
          keyword: "expression",
          filters: {
            bioset_type: ["Differential Expression", "Pathway Analysis"],
            organism: ["Escherichia coli"],
          },
          page: 2,
          sort: "bioset_id:asc",
        }}
        baseRql="eq(exp_id,*)"
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["services", "biosets"],
    });
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(exportAll).toHaveBeenCalledWith("bioset", {
      rql: 'and(eq(exp_id,*),and(or(eq(bioset_type,"Differential%20Expression"),eq(bioset_type,"Pathway%20Analysis")),eq(organism,"Escherichia%20coli")))',
      keyword: "expression",
      fields: ["exp_id"],
      sort: { field: "bioset_id", direction: "asc" },
    });
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(replace).toHaveBeenCalledWith(
      "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,00051))",
    );
  });

  it("rejects all matching Biosets when any lacks an experiment", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ close, opener: window, location: { replace } })),
    );
    const exportAll = vi.fn(() =>
      Promise.resolve({ rows: [{ exp_id: "00042" }, {}] }),
    );
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      isAllPagesSelected: true,
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Biosets action" }));

    await waitFor(() => {
      expect(close).toHaveBeenCalledOnce();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Some selected Biosets are not associated with experiments.",
      ),
    ).toBeInTheDocument();
  });

  it("reports a blocked pop-up for all-matching Bioset results without requesting rows", async () => {
    const user = userEvent.setup();
    const exportAll = vi.fn(() => Promise.resolve({ rows: [] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 2,
    });
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(
      await screen.findByText(
        "Allow pop-ups to open the selected Bioset results.",
      ),
    ).toBeVisible();
    // The tab is reserved before anything is fetched, so a blocked pop-up costs
    // nothing.
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("navigates the reserved Bioset tab with the IDs it resolved, not a later selection", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ opener: window, location: { replace }, close })),
    );
    let resolveExport:
      | ((value: { rows: { exp_id: string }[] }) => void)
      | undefined;
    const exportAll = vi.fn(
      () =>
        new Promise<{ rows: { exp_id: string }[] }>((resolve) => {
          resolveExport = resolve;
        }),
    );
    const allPages = {
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 2,
    };
    useResourceCollection.mockReturnValue(allPages);

    const view = render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(exportAll).toHaveBeenCalledTimes(1);

    // The user narrows the selection while the resolution is still in flight.
    useResourceCollection.mockReturnValue({
      ...allPages,
      isAllPagesSelected: false,
      rows: [{ bioset_id: "bioset-9", exp_id: "00099" }],
      selection: { "bioset-9": true },
      selectedIds: ["bioset-9"],
    });
    view.rerender(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      resolveExport?.({ rows: [{ exp_id: "00042" }] });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042))",
      );
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByText("Could not complete action")).not.toBeInTheDocument();
  });

  it("shows the Bioset failure even when its Error carries an empty message", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ opener: window, location: { replace }, close })),
    );
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 2,
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={
          {
            exportAll: vi.fn(() => Promise.reject(new Error(""))),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    // This sink used to pass `error.message` straight through, so an empty message
    // reached the shell as a falsy string and its `{actionError && (...)}` guard
    // rendered nothing at all: a closed tab and no reason for it.
    expect(await screen.findByText("Could not complete action")).toBeVisible();
    expect(
      screen.getByText("The selected Bioset results could not be loaded."),
    ).toBeVisible();
    expect(close).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
