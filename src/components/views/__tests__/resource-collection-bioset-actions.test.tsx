import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelledError } from "@tanstack/react-query";
import { maxExportRows, type DataRepository } from "@/lib/data-api";
import { biosetCollectionProfile } from "@/lib/experiment-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

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
vi.mock("@/hooks/views/use-collection-download", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionDownloadMock(),
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
vi.mock("@/components/search/search-action-bar", async () => {
  // Dynamic import: `vi.mock` factories run before static imports are linked.
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
    expect(screen.getByRole("button", { name: /^DOWNLOAD/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(selected).not.toHaveBeenCalled();
    // Reserved as `about:blank`: `noopener` makes `window.open` return null,
    // which hides a blocked pop-up.
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(open.mock.results[0].value).toMatchObject({ opener: null });
    expect(links).toStrictEqual([
      expect.objectContaining({
        href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042))",
        target: "_self",
        rel: "noreferrer",
      }),
    ]);
    expect(links[0].click).toHaveBeenCalledOnce();
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

  describe("while the rows and total belong to a previous query", () => {
    function renderAllPagesBiosets(
      overrides: Partial<ReturnType<typeof useResourceCollectionHook>>,
      exportAll = vi.fn(() =>
        Promise.resolve({ rows: [{ exp_id: "00042" }, { exp_id: "00051" }] }),
      ),
    ) {
      useResourceCollection.mockReturnValue({
        ...collectionResult(),
        activeId: null,
        detail: null,
        isAllPagesSelected: true,
        isPlaceholderData: true,
        rows: [{ bioset_id: "bioset-2", exp_id: "00051" }],
        selection: {},
        selectedIds: [],
        total: 2,
        ...overrides,
      });
      render(
        <ResourceCollection
          profile={biosetCollectionProfile}
          repository={{ exportAll } as unknown as DataRepository}
          state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
          baseRql="eq(exp_id,*)"
          onStateChange={vi.fn()}
        />,
      );
      return exportAll;
    }

    it("reserves the tab inside the click, then resolves all matching Biosets once the current query's total lands", async () => {
      const user = userEvent.setup();
      const { open, links, close } = reservedTab();
      const currentTotal = Promise.withResolvers<number>();
      const exportAll = renderAllPagesBiosets({
        total: maxExportRows + 1,
        currentTotal: () => currentTotal.promise,
      });

      await user.click(screen.getByRole("button", { name: "Biosets action" }));
      // Reserved before the wait: afterward the browser no longer treats the
      // open as user-initiated.
      expect(open).toHaveBeenCalledWith("about:blank", "_blank");
      expect(exportAll).not.toHaveBeenCalled();

      currentTotal.resolve(2);

      await waitFor(() => {
        expect(links).toStrictEqual([
          expect.objectContaining({
            href: "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,00051))",
          }),
        ]);
      });
      expect(exportAll).toHaveBeenCalledOnce();
      expect(close).not.toHaveBeenCalled();
    });

    it("applies the row limit to the current query's total and closes the reserved tab", async () => {
      const user = userEvent.setup();
      const { close, links } = reservedTab();
      const exportAll = renderAllPagesBiosets({
        total: 2,
        currentTotal: () => Promise.resolve(maxExportRows + 1),
      });

      await user.click(screen.getByRole("button", { name: "Biosets action" }));

      expect(
        await screen.findByText(
          "This selection contains 10,001 Biosets. Narrow the results to 10,000 or fewer and try again.",
        ),
      ).toBeVisible();
      expect(close).toHaveBeenCalledOnce();
      expect(links).toHaveLength(0);
      expect(exportAll).not.toHaveBeenCalled();
    });

    it("closes the reserved tab quietly when the query it waits for is replaced", async () => {
      const user = userEvent.setup();
      const { close, links } = reservedTab();
      const exportAll = renderAllPagesBiosets({
        currentTotal: () => Promise.reject(new CancelledError()),
      });

      await user.click(screen.getByRole("button", { name: "Biosets action" }));

      await waitFor(() => {
        expect(close).toHaveBeenCalledOnce();
      });
      expect(
        screen.queryByText("Could not complete action"),
      ).not.toBeInTheDocument();
      expect(links).toHaveLength(0);
      expect(exportAll).not.toHaveBeenCalled();
    });
  });

  it("closes the reserved tab when the read stops at the export cap and more Biosets match", async () => {
    const user = userEvent.setup();
    const { close, links } = reservedTab();
    const exportAll = vi.fn(() =>
      Promise.resolve({
        rows: Array.from({ length: maxExportRows }, (_, index) => ({
          exp_id: String(index),
        })),
      }),
    );
    const collection = vi.fn(() => Promise.resolve({ total: 10_412 }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: null,
      detail: null,
      isAllPagesSelected: true,
      isRefreshing: true,
      rows: [{ bioset_id: "bioset-2", exp_id: "00051" }],
      selection: {},
      selectedIds: [],
      total: 9_000,
    });

    render(
      <ResourceCollection
        profile={biosetCollectionProfile}
        repository={{ exportAll, collection } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        baseRql="eq(exp_id,*)"
        onStateChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Biosets action" }));

    expect(
      await screen.findByText(
        "This selection contains 10,412 Biosets. Narrow the results to 10,000 or fewer and try again.",
      ),
    ).toBeVisible();
    expect(close).toHaveBeenCalledOnce();
    expect(links).toHaveLength(0);
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

  it("rejects all matching Biosets when none has an experiment", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ close, opener: window, location: { replace } })),
    );
    const exportAll = vi.fn(() =>
      Promise.resolve({ rows: [{}, {}] }),
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
        "No experiments are associated with this selection.",
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
    expect(open).toHaveBeenCalledExactlyOnceWith("about:blank", "_blank");
    expect(
      await screen.findByText(
        "Allow pop-ups to open the selected Bioset results.",
      ),
    ).toBeVisible();
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
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("guards an all-pages Bioset lookup and recovers after rejection", async () => {
    const user = userEvent.setup();
    const { open, close } = reservedTab();
    let rejectExport: ((reason: Error) => void) | undefined;
    const exportAll = vi.fn(
      () =>
        new Promise<{ rows: { exp_id: string }[] }>((_resolve, reject) => {
          rejectExport = reject;
        }),
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
        repository={{ exportAll } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "bioset_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Biosets action" });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(exportAll).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();

    rejectExport?.(new Error("lookup failed"));
    await waitFor(() => expect(button).toBeEnabled());
    expect(close).toHaveBeenCalledOnce();

    await user.click(button);
    expect(exportAll).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(2);
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
    expect(await screen.findByText("Could not complete action")).toBeVisible();
    expect(
      screen.getByText("The selected Bioset results could not be loaded."),
    ).toBeVisible();
    expect(close).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
