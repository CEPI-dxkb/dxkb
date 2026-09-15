import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { experimentCollectionProfile } from "@/lib/experiment-view/profile";
import { featureCollectionProfile } from "@/lib/feature-view/profile";
import { genomeCollectionProfile } from "@/lib/genome-view/profile";
import { strainCollectionProfile } from "@/lib/strain-view/profile";
import { surveillanceCollectionProfile } from "@/lib/surveillance-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

// The member-navigation actions `useResourceCollectionActions` dispatches straight to
// a row's own or a derived canonical destination — GENOME, FEATURE, EXPERIMENT,
// SURVEILLANCE, the Strain Genomes list, and the Interaction FEATURES pool — kept apart
// from the shared enable/disable selection-action tests so a broken destination href
// fails on its own instead of inside a resource's "enables ..." test.

const { push, useResourceCollection } = vi.hoisted(() => ({
  push: vi.fn(),
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));
let actionBarProps: Record<string, unknown>;

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
  SelectionServiceChooser: ({
    open,
    kind = "genome",
    hasSelectableServices = true,
  }: {
    open: boolean;
    kind?: "genome" | "feature";
    hasSelectableServices?: boolean;
  }) =>
    open ? (
      <div data-testid="selection-services" data-kind={kind}>
        {hasSelectableServices
          ? "Selectable services"
          : "No selectable services"}
      </div>
    ) : null,
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
      </div>
    );
  },
}));

const state = {
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

function collectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
) {
  return createResourceCollectionResult({
    activeId: "83332.12",
    detail: row,
    facets: { genome_status: [{ value: "Complete", count: 1 }] },
    rows: [row],
    selection: { "83332.12": true },
    selectedIds: ["83332.12"],
    sorting: [{ id: "genome_length", desc: true }],
    total: 1,
    ...overrides,
  });
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
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection resource-navigation actions", () => {
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

  it("enables the Strain Genomes action and opens its canonical Genome list in the same tab", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [
        {
          id: "strain-row-1",
          strain: "A/fixture/2025",
          genome_ids: ["11320.1", "11320.2"],
        },
        {
          id: "strain-row-2",
          strain: "A/fixture/2026",
          genome_ids: ["11320.2", "11320.3"],
        },
      ],
      selection: { "strain-row-1": true, "strain-row-2": true },
      selectedIds: ["strain-row-1", "strain-row-2"],
    });

    const strainRepository = repository(
      Promise.resolve({
        rows: [
          { genome_ids: ["11320.1", "11320.2"] },
          { genome_ids: ["11320.2", "11320.3"] },
        ],
      }),
    );
    render(
      <ResourceCollection
        profile={strainCollectionProfile}
        repository={strainRepository}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["copyRows", "services", "genomes", "group"],
      disabledActions: undefined,
    });
    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    expect(push).toHaveBeenCalledWith(
      "/genome?rql=in(genome_id%2C(11320.1%2C11320.2%2C11320.3))",
    );
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

  it("pools both interactors for the Interaction FEATURES action", async () => {
    const user = userEvent.setup();
    const interactionRows = [
      { id: "ppi-1", feature_id_a: "feature-a1", feature_id_b: "feature-b1" },
      { id: "ppi-2", feature_id_a: "feature-a2", feature_id_b: "feature-a1" },
    ];
    const selected = vi.fn(() => Promise.resolve({ rows: interactionRows }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "ppi-1",
      detail: interactionRows[0],
      rows: interactionRows,
      selection: { "ppi-1": true, "ppi-2": true },
      selectedIds: ["ppi-1", "ppi-2"],
    });

    render(
      <ResourceCollection
        profile={{
          resource: "ppi",
          label: "Interactions",
          idField: "id",
          columns: [
            { id: "feature_id_a", label: "Interactor A" },
            { id: "feature_id_b", label: "Interactor B" },
          ],
          defaultSort: "id:asc",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "id:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "ppi",
      enabledActions: ["copyRows", "services", "ppiFeatures", "group"],
      disabledActions: undefined,
    });

    await user.click(
      screen.getByRole("button", { name: "Interaction features action" }),
    );
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("ppi", {
        ids: ["ppi-1", "ppi-2"],
        fields: ["feature_id_a", "feature_id_b"],
      });
    });
    // Legacy pools feature_id_a and feature_id_b across every selected row.
    expect(push).toHaveBeenCalledWith(
      "/feature?rql=in(feature_id%2C(feature-a1%2Cfeature-b1%2Cfeature-a2))",
    );

    // Legacy errors with "Missing or invalid type for Services" on this tab.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
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
});
