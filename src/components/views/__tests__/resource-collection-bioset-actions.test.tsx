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

vi.mock("next/navigation", async () =>
  (await import("./fixtures/resource-collection-mocks")).nextNavigationMock(),
);
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/lib/auth/provider", async () =>
  (await import("./fixtures/resource-collection-mocks")).authProviderMock(),
);
vi.mock("@/contexts/workspace-repository-context", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).workspaceRepositoryContextMock(),
);
vi.mock("../collection-copy-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionCopyDialogMock(),
);
vi.mock("../selection-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionServiceChooserMock(),
);
vi.mock("@/components/workspace/selection-to-group-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionToGroupDialogMock(),
);
vi.mock("../resource-export", async () =>
  (await import("./fixtures/resource-collection-mocks")).resourceExportMock(),
);
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("../resource-filter-bar", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).resourceFilterBarMock(),
);
// The `SearchActionBar` fake shared with every resource-collection*.test.tsx suite.
// It calls the same `visibleSearchActions` / `isSearchActionDisabled` policy
// production does (search-action-policy.ts), so a control this suite can query or
// click is one the real bar would have rendered, in the same enabled state.
vi.mock("@/components/search/search-action-bar", async () => {
  // A dynamic import, not a static one: `vi.mock` factories run before the file's own
  // static imports are linked, so a statically-imported helper referenced here throws
  // ("Cannot access ... before initialization"). Awaiting the import inside the
  // factory sidesteps that — `beforeEach`/the tests below still resolve normally.
  const { createSearchActionBarFake } =
    await import("./fixtures/search-action-bar-fake");
  return {
    SearchActionBar: createSearchActionBarFake(
      (props: Record<string, unknown>) => {
        actionBarProps = props;
      },
    ),
  };
});
vi.mock("@/components/detail-panel/info-panel", async () =>
  (await import("./fixtures/resource-collection-mocks")).infoPanelMock(),
);
vi.mock("../taxonomy-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).taxonomyServiceChooserMock(),
);
vi.mock("../resource-workspace", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).flatResourceWorkspaceMock(),
);
vi.mock("@/components/shared/data-table", async () =>
  (await import("./fixtures/resource-collection-mocks")).dataTableMock(
    (props) => {
      dataTableProps = props;
    },
  ),
);

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

/**
 * A stand-in for the tab both Bioset paths reserve with `window.open("about:blank")`.
 * Both navigate it through `navigateReservedTab`, by clicking an
 * `<a target="_self" rel="noreferrer">` created in the reserved document, so `links`
 * is where the destination assertions look. `location.replace` is still captured, and
 * asserted *not* called: the all-pages path used to navigate that way, which sends the
 * destination a referrer.
 */
function reservedTab() {
  const links: {
    href?: string;
    target?: string;
    rel?: string;
    click: ReturnType<typeof vi.fn>;
  }[] = [];
  const replace = vi.fn();
  const close = vi.fn();
  const createElement = vi.fn(() => {
    const link = { click: vi.fn() };
    links.push(link);
    return link;
  });
  const open = vi.fn(() => ({
    opener: window,
    document: { createElement },
    location: { replace },
    close,
  }));
  vi.stubGlobal("open", open);
  return { open, links, replace, close };
}

beforeEach(() => {
  useResourceCollection.mockReturnValue(collectionResult());
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection Bioset actions", () => {
  it("supports legacy Bioset sidebar actions", async () => {
    const user = userEvent.setup();
    const { open, links, replace } = reservedTab();
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
          guideUrl: "https://example.test/guide",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
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
    // A reserved `about:blank`, not the final href with `noopener,noreferrer`: the
    // spec makes `window.open` return null whenever `noopener` is set, so the handle
    // could not tell a blocked pop-up from an allowed one. Reserving keeps the
    // handle meaningful *and* keeps `noreferrer` on the navigation.
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    // `opener` is severed while the tab is still same-origin and empty.
    expect(open.mock.results[0].value).toMatchObject({ opener: null });
    expect(links).toStrictEqual([
      expect.objectContaining({
        href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042))",
        target: "_self",
        rel: "noreferrer",
      }),
    ]);
    expect(links[0].click).toHaveBeenCalledOnce();
    // Nothing reaches for `location.replace` any more — it would send the
    // destination a referrer, which is why all three paths click an anchor instead.
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
    const biosetsButton = screen.getByRole("button", {
      name: "Biosets action",
    });
    expect(biosetsButton).toBeDisabled();
    await user.click(biosetsButton);
    expect(open).not.toHaveBeenCalled();
  });

  it("resolves Bioset experiment IDs retained across pages", async () => {
    const user = userEvent.setup();
    const { open, links } = reservedTab();
    const selected = vi.fn();
    const profile = {
      resource: "bioset" as const,
      label: "Biosets",
      idField: "bioset_id",
      columns: [{ id: "bioset_id", label: "Bioset ID" }],
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
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(links).toStrictEqual([
      expect.objectContaining({
        href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,00051))",
        target: "_self",
        rel: "noreferrer",
      }),
    ]);
  });

  it("resolves all matching Bioset experiment IDs", async () => {
    const user = userEvent.setup();
    const { open, links, replace } = reservedTab();
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
    // Navigated by the same `navigateReservedTab` anchor as the other two pop-up
    // paths, so this one no longer hands the destination a referrer either. It used
    // to call `resultsWindow.location.replace(href)`, which does.
    expect(links).toStrictEqual([
      expect.objectContaining({
        href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,00051))",
        target: "_self",
        rel: "noreferrer",
      }),
    ]);
    expect(links[0].click).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
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

  it("reports a blocked pop-up for an explicitly selected Bioset's results", async () => {
    const user = userEvent.setup();
    const selected = vi.fn(() => Promise.resolve({ rows: [] }));
    const open = vi.fn(() => null);
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "bioset-1",
      detail: { bioset_id: "bioset-1", exp_id: "00042" },
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: { "bioset-1": true },
      selectedIds: ["bioset-1"],
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    // This branch used to discard the result of `window.open` entirely, so a
    // blocked pop-up looked exactly like a click that did nothing.
    // Reserved, then abandoned: the handle was null, so nothing was navigated and
    // no second attempt was made.
    expect(open).toHaveBeenCalledExactlyOnceWith("about:blank", "_blank");
    expect(
      await screen.findByText(
        "Allow pop-ups to open the selected Bioset results.",
      ),
    ).toBeVisible();
    // Same wording and same sink as the all-matching branch below, so the two
    // failures read identically to the user.
    expect(screen.getByText("Could not complete action")).toBeVisible();
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
    const { links, replace, close } = reservedTab();
    let resolveExport:
      ((value: { rows: { exp_id: string }[] }) => void) | undefined;
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
      />,
    );

    await act(async () => {
      resolveExport?.({ rows: [{ exp_id: "00042" }] });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(links).toHaveLength(1);
    });
    expect(links[0]).toEqual(
      expect.objectContaining({
        href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042))",
        target: "_self",
        rel: "noreferrer",
      }),
    );
    expect(links[0].click).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Could not complete action"),
    ).not.toBeInTheDocument();
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
