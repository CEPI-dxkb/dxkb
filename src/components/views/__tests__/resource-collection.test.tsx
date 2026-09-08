import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import {
  biosetCollectionProfile,
  experimentCollectionProfile,
} from "@/lib/experiment-view/profile";
import { featureCollectionProfile } from "@/lib/feature-view/profile";
import { genomeCollectionProfile } from "@/lib/genome-view/profile";
import { strainCollectionProfile } from "@/lib/strain-view/profile";
import { surveillanceCollectionProfile } from "@/lib/surveillance-view/profile";
import type { CollectionState } from "@/lib/views/collection-state";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";

const { push, downloadResourceExport, useResourceCollection } = vi.hoisted(
  () => ({
    push: vi.fn(),
    downloadResourceExport: vi.fn(),
    useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
  }),
);
let dataTableProps: Record<string, unknown>;
let actionBarProps: Record<string, unknown>;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../resource-export", () => ({ downloadResourceExport }));
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("../resource-filter-bar", () => ({
  ResourceFilterBar: (props: Record<string, unknown>) => (
    <div
      data-testid="filter-bar"
      data-definitions={JSON.stringify(props.definitions)}
      data-keyword={typeof props.keyword === "string" ? props.keyword : ""}
    >
      {["dna gy", "HUMAN", "absent", "N034", undefined].map((keyword) => (
        <button
          key={keyword ?? "clear"}
          onClick={() => {
            const onChange = props.onChange as (update: {
              keyword?: string;
              filters: CollectionState["filters"];
            }) => void;
            onChange({
              keyword,
              filters: props.filters as CollectionState["filters"],
            });
          }}
        >
          {keyword === "dna gy"
            ? "Filter loaded rows"
            : keyword === "HUMAN"
              ? "Filter array value"
              : keyword === "N034"
                ? "Refine server results"
                : keyword
                  ? "Filter no matches"
                  : "Clear loaded filter"}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/search/search-action-bar", () => ({
  SearchActionBar: (props: Record<string, unknown>) => {
    actionBarProps = props;
    return (
      <div>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "genome",
            )
          }
        >
          Genome action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "genomes",
            )
          }
        >
          Genomes action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "feature",
            )
          }
        >
          Feature action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "surveillance",
            )
          }
        >
          Surveillance action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "experiment",
            )
          }
        >
          Experiment action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "download",
            )
          }
        >
          Download action
        </button>
        <button
          onClick={() =>
            (props.onAction as ((action: string) => void) | undefined)?.(
              "biosets",
            )
          }
        >
          Biosets action
        </button>
      </div>
    );
  },
}));
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
    const columns = props.columns as {
      id: string;
      href?: (row: Record<string, unknown>) => string | undefined;
    }[];
    const rows = props.data as Record<string, unknown>[];
    const linkColumn = columns.find((column) => column.href);
    return (
      <div data-testid="data-table">
        {linkColumn?.href && rows.length > 0 ? (
          <a href={linkColumn.href(rows[0])}>{String(rows[0].genome_name)}</a>
        ) : null}
        <button
          onClick={() =>
            void (
              props.onDownloadAll as (
                format: "csv",
                fields: null,
              ) => Promise<void>
            )("csv", null)
          }
        >
          Export all
        </button>
      </div>
    );
  },
}));

const state: CollectionState = {
  keyword: "coli",
  filters: { genome_status: ["Complete"] },
  page: 3,
  sort: "genome_length:desc",
};
const row = {
  genome_id: "83332.12",
  genome_name: "E. coli fixture",
  genome_length: 1234,
};

function collectionResult() {
  return {
    activeId: "83332.12",
    detail: row,
    detailError: null,
    facets: { genome_status: [{ value: "Complete", count: 1 }] },
    isAllPagesSelected: false,
    isDetailLoading: false,
    isInitialLoading: false,
    isRefreshing: false,
    error: null,
    refetch: vi.fn(),
    rows: [row],
    selection: { "83332.12": true as const },
    selectedIds: ["83332.12"],
    sorting: [{ id: "genome_length", desc: true }],
    total: 1,
    setIsAllPagesSelected: vi.fn(),
    setSelection: vi.fn(),
    setPageIndex: vi.fn(),
    setSorting: vi.fn(),
  };
}

function repository(
  exportResult: Promise<unknown> = Promise.resolve({ rows: [row] }),
) {
  return {
    exportAll: vi.fn(() => exportResult),
    selected: vi.fn(() => exportResult),
  } as unknown as DataRepository;
}

beforeEach(() => {
  useResourceCollection.mockReturnValue(collectionResult());
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection Genome integration contracts", () => {
  it("keeps global and taxon-scoped views on the same profile and interaction surface", () => {
    const global = render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );
    const globalHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    if (!globalHookOptions) throw new Error("Collection hook was not called");
    const globalTable = dataTableProps;
    const globalActions = actionBarProps;
    const globalFacets = screen.getByTestId("filter-bar").dataset.definitions;
    expect(screen.getByTestId("detail")).toHaveTextContent("E. coli fixture");
    global.unmount();

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
        showHeader={false}
      />,
    );
    const scopedHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];

    expect(scopedHookOptions).toMatchObject({
      resource: globalHookOptions.resource,
      idField: globalHookOptions.idField,
      fields: globalHookOptions.fields,
      detailFields: globalHookOptions.detailFields,
      facetFields: globalHookOptions.facetFields,
      structuralRql:
        "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))",
    });
    expect(dataTableProps).toMatchObject({
      columns: globalTable.columns,
      pageIndex: globalTable.pageIndex,
      pageSize: globalTable.pageSize,
      sorting: globalTable.sorting,
      onPageChange: globalTable.onPageChange,
      onSortingChange: globalTable.onSortingChange,
    });
    expect(actionBarProps).toMatchObject({
      searchType: globalActions.searchType,
      selectedCount: globalActions.selectedCount,
    });
    expect(screen.getByTestId("filter-bar").dataset.definitions).toBe(
      globalFacets,
    );
    expect(screen.getByTestId("detail")).toHaveTextContent("E. coli fixture");
  });

  it("preserves collection errors and supports retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const message = "Genome service unavailable";
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      error: new Error(message),
      refetch,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(message);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("projects row links and opens the Genome action in a new tab", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(
      screen.getByRole("link", { name: "E. coli fixture" }),
    ).toHaveAttribute("href", "/genome/83332.12");
    await user.click(screen.getByRole("button", { name: "Genome action" }));
    expect(open).toHaveBeenCalledWith(
      "/genome/83332.12",
      "_blank",
      "noopener,noreferrer",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("enables the Strain Genomes action and opens its canonical Genome list", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "strain-row-1",
      detail: {
        id: "strain-row-1",
        strain: "A/fixture/2025",
        genome_ids: ["11320.1", "11320.2", "11320.1"],
      },
      rows: [
        {
          id: "strain-row-1",
          strain: "A/fixture/2025",
          genome_ids: ["11320.1", "11320.2", "11320.1"],
        },
      ],
      selection: { "strain-row-1": true },
      selectedIds: ["strain-row-1"],
    });

    render(
      <ResourceCollection
        profile={strainCollectionProfile}
        repository={repository()}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["genomes"],
      disabledActions: undefined,
    });
    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    expect(open).toHaveBeenCalledWith(
      "/genome?rql=in(genome_id%2C(11320.1%2C11320.2))",
      "_blank",
      "noopener,noreferrer",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the Strain Genomes action disabled without associated genomes", () => {
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "strain-row-1",
      detail: { id: "strain-row-1", strain: "A/fixture/2025" },
      rows: [{ id: "strain-row-1", strain: "A/fixture/2025" }],
      selection: { "strain-row-1": true },
      selectedIds: ["strain-row-1"],
    });

    render(
      <ResourceCollection
        profile={strainCollectionProfile}
        repository={repository()}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: undefined,
      disabledActions: {
        genomes: "No genomes are associated with this strain",
      },
    });
  });

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
      enabledActions: ["biosets"],
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

  it("disables Bioset results when any selected Bioset lacks an experiment", async () => {
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
      enabledActions: undefined,
      disabledActions: {
        biosets: "Some selected Biosets are not associated with experiments",
      },
    });
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
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

    expect(actionBarProps).toMatchObject({ enabledActions: ["biosets"] });
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

    expect(actionBarProps).toMatchObject({ enabledActions: ["biosets"] });
    await user.click(screen.getByRole("button", { name: "Biosets action" }));
    expect(exportAll).toHaveBeenCalledWith("bioset", {
      rql:
        'and(eq(exp_id,*),and(or(eq(bioset_type,"Differential%20Expression"),eq(bioset_type,"Pathway%20Analysis")),eq(organism,"Escherichia%20coli")))',
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

  it("opens the selected Experiment member in a new tab", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "00042",
      detail: { exp_id: "00042", exp_title: "Fixture experiment" },
      rows: [{ exp_id: "00042", exp_title: "Fixture experiment" }],
      selection: { "00042": true },
      selectedIds: ["00042"],
    });

    render(
      <ResourceCollection
        profile={experimentCollectionProfile}
        repository={repository()}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Experiment action" }));
    expect(open).toHaveBeenCalledWith(
      "/experiment/00042",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens the selected feature member in a new tab", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "canonical-feature",
      detail: {
        feature_id: "canonical-feature",
        patric_id: "fig|83332.12.peg.1",
        genome_id: "83332.12",
      },
      rows: [
        {
          feature_id: "canonical-feature",
          patric_id: "fig|83332.12.peg.1",
          genome_id: "83332.12",
        },
      ],
      selection: { "canonical-feature": true },
      selectedIds: ["canonical-feature"],
    });

    render(
      <ResourceCollection
        profile={featureCollectionProfile}
        repository={repository()}
        state={{ ...state, sort: "patric_id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Feature action" }));
    expect(open).toHaveBeenCalledWith(
      "/feature/canonical-feature",
      "_blank",
      "noopener,noreferrer",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the selected Surveillance member with its test type", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "surveillance-backend-901",
      detail: {
        id: "surveillance-backend-901",
        sample_identifier: "sample/1",
        pathogen_test_type: ["RAT/antigen"],
      },
      rows: [
        {
          id: "surveillance-backend-901",
          sample_identifier: "sample/1",
          pathogen_test_type: ["RAT/antigen"],
        },
      ],
      selection: { "surveillance-backend-901": true },
      selectedIds: ["surveillance-backend-901"],
    });

    render(
      <ResourceCollection
        profile={surveillanceCollectionProfile}
        repository={repository()}
        state={{
          keyword: "",
          filters: {},
          page: 1,
          sort: "sample_identifier:asc",
        }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Surveillance action" }),
    );
    expect(open).toHaveBeenCalledWith(
      "/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen",
      "_blank",
      "noopener,noreferrer",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("routes action-bar downloads through export-all for an all-pages selection", async () => {
    const user = userEvent.setup();
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      isAllPagesSelected: true,
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download action" }));

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "eq(genome_status,Complete)",
      keyword: "coli",
      fields: genomeCollectionProfile.columns.map((column) => column.id),
      sort: { field: "genome_length", direction: "desc" },
    });
  });

  it("requests all matching rows using the active scope, sort, and columns", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
        showHeader={false}
        keywordMode="server"
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))",
      keyword: "coli",
      fields: genomeCollectionProfile.columns.map((column) => column.id),
      sort: { field: "genome_length", direction: "desc" },
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [row],
      genomeCollectionProfile.columns,
      genomeCollectionProfile.columns.map((column) => column.id),
      "csv",
    );
  });

  it("preserves backend order when exporting an unsorted collection", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={{ ...genomeCollectionProfile, defaultSort: "unsorted" }}
        repository={data}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({ sort: undefined }),
    );
  });

  it("exports selected displayed columns without requiring the ID in the output", async () => {
    const data = repository();
    const selected = vi.spyOn(data, "selected");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadSelected as (
          format: "csv",
          ids: string[],
          fields: string[],
        ) => Promise<void>
      )("csv", ["83332.12"], ["genome_name"]);
    });

    expect(selected).toHaveBeenCalledWith("genome", {
      ids: ["83332.12"],
      fields: ["genome_name"],
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [row],
      genomeCollectionProfile.columns,
      ["genome_name"],
      "csv",
    );
  });

  it("does not export all using a stale total while results refresh", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      isRefreshing: true,
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).not.toHaveBeenCalled();
    expect(screen.getByText(/finish loading before exporting/)).toBeVisible();
  });

  it("rejects all-matching exports over 10,000 rows before requesting data", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      total: 10_001,
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).not.toHaveBeenCalled();
    expect(screen.getByText(/This export matches 10,001 rows/)).toBeVisible();
  });

  it("shows full-detail errors instead of a partial row", () => {
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      detailError: new Error("Genome detail service unavailable"),
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(screen.getByText("Could not load record details")).toBeVisible();
    expect(screen.getByText("Genome detail service unavailable")).toBeVisible();
    expect(screen.queryByTestId("detail")).not.toBeInTheDocument();
  });

  it("updates collection state when the server keyword changes", async () => {
    const onStateChange = vi.fn();

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={onStateChange}
        showHeader={false}
        keywordMode="server"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "coli",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      keyword: "dna gy",
      page: 1,
    });
  });

  it("filters loaded rows without changing the server query or collection state", async () => {
    const onStateChange = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={onStateChange}
        showHeader={false}
        keywordMode="loaded"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "",
    );
    const initialHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(initialHookOptions?.state.keyword).toBeUndefined();

    await userEvent.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ]);
    });
    expect(dataTableProps.totalItems).toBe(1);
    expect(dataTableProps.pageIndex).toBe(0);
    expect(onStateChange).not.toHaveBeenCalled();
    const hookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(hookOptions?.state.keyword).toBeUndefined();
    hookOptions?.onStateChange({ ...state, keyword: undefined, page: 4 });
    expect(onStateChange).toHaveBeenCalledWith({ ...state, page: 4 });

    await userEvent.click(
      screen.getByRole("button", { name: "Clear loaded filter" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toHaveLength(2);
    });
    expect(dataTableProps.totalItems).toBe(2);
    expect(dataTableProps.pageIndex).toBe(2);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it("refines the server query while preserving the primary keyword in URL state", async () => {
    const onStateChange = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        { genome_id: "83332.13", genome_name: "Unmatched current-page row" },
      ],
      total: 160,
    });

    const refinedState = {
      ...state,
      keyword: "influenza",
      refine: "existing refinement",
    };
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={refinedState}
        onStateChange={onStateChange}
        showHeader={false}
        keywordMode="refine"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "existing refinement",
    );
    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toMatchObject({
      structuralRql:
        "and(eq(genome_status,Complete),keyword(existing refinement))",
      state: { keyword: "influenza" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Refine server results" }),
    );

    expect(onStateChange).toHaveBeenCalledWith({
      ...refinedState,
      refine: "N034",
      page: 1,
    });
    expect(dataTableProps.data).toHaveLength(2);
    expect(dataTableProps.totalItems).toBe(160);
  });

  it("clears hidden selections and exports loaded-keyword matches from every page", async () => {
    const user = userEvent.setup();
    const laterMatch = {
      genome_id: "83332.14",
      genome_name: "DNA gyrase from a later page",
      genome_length: 9012,
    };
    const data = repository(
      Promise.resolve({
        rows: [
          row,
          {
            genome_id: "83332.13",
            genome_name: "DNA gyrase fixture",
            genome_length: 5678,
          },
          laterMatch,
        ],
      }),
    );
    const selected = vi.spyOn(data, "selected");
    const exportAll = vi.spyOn(data, "exportAll");
    const setSelection = vi.fn();
    const setIsAllPagesSelected = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: { "83332.12": true, "83332.13": true },
      selectedIds: ["83332.12", "83332.13"],
      total: 401,
      setSelection,
      setIsAllPagesSelected,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
        keywordMode="loaded"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ]);
    });
    expect(setSelection).toHaveBeenCalledWith({});
    expect(setIsAllPagesSelected).toHaveBeenCalledWith(false);
    expect(dataTableProps).toMatchObject({
      rowSelection: { "83332.13": true },
      selectedIds: ["83332.13"],
      isAllPagesSelected: false,
      totalSelectedCount: 1,
    });
    expect(actionBarProps.selectedCount).toBe(1);

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "eq(genome_status,Complete)",
      keyword: undefined,
      fields: genomeCollectionProfile.columns.map((column) => column.id),
      sort: { field: "genome_length", direction: "desc" },
    });
    expect(selected).not.toHaveBeenCalled();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
        laterMatch,
      ],
      genomeCollectionProfile.columns,
      genomeCollectionProfile.columns.map((column) => column.id),
      "csv",
    );
  });

  it("matches array values case-insensitively and handles no local matches", async () => {
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        { ...row, host_name: ["Homo sapiens", "Human"] },
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
        keywordMode="loaded"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Filter array value" }),
    );
    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        { ...row, host_name: ["Homo sapiens", "Human"] },
      ]);
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Filter no matches" }),
    );
    await waitFor(() => {
      expect(dataTableProps.data).toEqual([]);
    });
    expect(dataTableProps.totalItems).toBe(0);
  });

  it("omits the URL keyword from loaded-mode collection requests", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
        keywordMode="loaded"
      />,
    );

    const hookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(hookOptions?.state.keyword).toBeUndefined();
    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "",
    );
  });

  it("keeps the data table mounted when no rows are available", () => {
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [],
      selection: {},
      selectedIds: [],
      total: 0,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={{ ...state, keyword: "", filters: {}, page: 1 }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(screen.getByTestId("data-table")).toBeInTheDocument();
    expect(dataTableProps).toMatchObject({ data: [], totalItems: 0 });
  });

  it("passes the effective RQL to delegated exports", async () => {
    const onExport = vi.fn();
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={{ ...state, rql: "eq(genome_id,83332.12)" }}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
        showHeader={false}
        onExport={onExport}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(onExport).toHaveBeenCalledWith({
      format: "csv",
      selectedIds: undefined,
      fields: null,
      rql: "and(and(eq(taxon_lineage_ids,561),eq(genome_id,*)),eq(genome_id,83332.12))",
    });
  });

  it("makes export failures visible without exposing diagnostics", async () => {
    const error = new Error("Genome export service unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const data = repository(Promise.reject(error));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });
    await waitFor(() =>
      expect(
        screen.getByText(
          "The requested export could not be created. Please try again.",
        ),
      ).toBeVisible(),
    );
    expect(
      screen.queryByText("Genome export service unavailable"),
    ).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Resource export failed:", error);
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });
});
