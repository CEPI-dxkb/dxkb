import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository, DataResource } from "@/lib/data-api";
import { experimentCollectionProfile } from "@/lib/experiment-view/profile";
import { featureCollectionProfile } from "@/lib/feature-view/profile";
import { genomeCollectionProfile } from "@/lib/genome-view/profile";
import { proteinFeatureCollectionProfile } from "@/lib/protein-feature-view/profile";
import { proteinStructureCollectionProfile } from "@/lib/protein-structure-view/profile";
import { strainCollectionProfile } from "@/lib/strain-view/profile";
import { serologyCollectionProfile } from "@/lib/serology-view/profile";
import { surveillanceCollectionProfile } from "@/lib/surveillance-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

// The action surface every non-Taxonomy, non-Bioset resource exposes through
// `CollectionSelectionActions`: which of COPY ROWS / SERVICES / GROUP / GENOMES /
// FEATURES / DWNLD a resource owns, what its row selection resolves to, and why an
// entry is disabled when the selection cannot reach it. Taxonomy and Bioset get their
// own files because both need a network round-trip before they can navigate; every
// other resource's action surface is exercised here, one resource at a time and then
// again as a single cross-resource matrix.

const { push, downloadResourceExport, useResourceCollection } = vi.hoisted(
  () => ({
    push: vi.fn(),
    downloadResourceExport: vi.fn(),
    useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
  }),
);
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
  downloadResourceExport,
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
// search-action-bar.tsx's actionConfig) lives in one place. See the fixture's own doc
// comment for what it does and does not model. The cross-resource matrix below still
// asserts the full enabledActions/disabledActions prop values directly (captured here
// as actionBarProps), independent of what this fake renders.
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
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection sequence actions", () => {
  it("enables selected-row download and the associated Genome destination", async () => {
    const user = userEvent.setup();
    const sequenceRow = {
      sequence_id: "83332.12.con.0001",
      genome_id: "83332.12",
      genome_name: "E. coli fixture",
    };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: sequenceRow.sequence_id,
      detail: sequenceRow,
      rows: [sequenceRow],
      selection: { [sequenceRow.sequence_id]: true },
      selectedIds: [sequenceRow.sequence_id],
    });
    const selected = vi.fn(() => Promise.resolve({ rows: [sequenceRow] }));
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(
      <ResourceCollection
        profile={{
          resource: "genome_sequence",
          label: "Sequences",
          idField: "sequence_id",
          columns: [
            { id: "sequence_id", label: "Sequence ID" },
            { id: "genome_id", label: "Genome ID" },
          ],
          defaultSort: "sequence_id:asc",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "sequence_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "genome_sequence",
      // FEATURES is enabled alongside the owned actions; FASTA and Browser are not.
      enabledActions: ["copyRows", "services", "group", "features"],
      disabledActions: undefined,
    });
    await user.click(screen.getByRole("button", { name: "Download action" }));
    expect(selected).toHaveBeenCalledWith("genome_sequence", {
      ids: [sequenceRow.sequence_id],
      fields: ["sequence_id", "genome_id"],
    });
    await user.click(screen.getByRole("button", { name: "Genome action" }));
    await user.click(screen.getByRole("button", { name: "Features action" }));
    expect(open).toHaveBeenNthCalledWith(
      1,
      "/genome/83332.12",
      "_blank",
      "noopener,noreferrer",
    );
    expect(open).toHaveBeenNthCalledWith(
      2,
      "/feature?rql=and(eq(sequence_id%2C83332.12.con.0001)%2Ceq(annotation%2CPATRIC)%2Ceq(feature_type%2CCDS))",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("resolves the selected Sequences' Genome IDs for the SERVICES chooser", async () => {
    const user = userEvent.setup();
    const sequenceRow = {
      sequence_id: "83332.12.con.0001",
      genome_id: "83332.12",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [sequenceRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: sequenceRow.sequence_id,
      detail: sequenceRow,
      rows: [sequenceRow],
      selection: { [sequenceRow.sequence_id]: true },
      selectedIds: [sequenceRow.sequence_id],
    });

    render(
      <ResourceCollection
        profile={{
          resource: "genome_sequence",
          label: "Sequences",
          idField: "sequence_id",
          columns: [
            { id: "sequence_id", label: "Sequence ID" },
            { id: "genome_id", label: "Genome ID" },
          ],
          defaultSort: "sequence_id:asc",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "sequence_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "services" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("genome_sequence", {
        ids: [sequenceRow.sequence_id],
        fields: ["genome_id"],
      });
    });
    expect(await screen.findByText("Selectable services")).toBeVisible();
  });
});

describe("ResourceCollection selection actions", () => {
  it("enables the shared Genome selection actions and resolves genome IDs from the rows", async () => {
    const user = userEvent.setup();
    const selected = vi.fn(() =>
      Promise.resolve({ rows: [{ genome_id: "83332.12" }] }),
    );

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{
          keyword: "coli",
          filters: { genome_status: ["Complete"] },
          page: 3,
          sort: "genome_length:desc",
        }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["copyRows", "services", "group"],
      disabledActions: undefined,
    });

    await user.click(screen.getByRole("button", { name: "services" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("genome", {
        ids: ["83332.12"],
        fields: ["genome_id"],
      });
    });
  });

  it("enables COPY ROWS, DWNLD and an empty SERVICES chooser for Sequence Features", async () => {
    const user = userEvent.setup();
    const sequenceFeatureRow = {
      id: "sfvt-row-1",
      sf_name: "HA1-1",
      sf_id: "SFVT-0001",
    };
    const selected = vi.fn(() =>
      Promise.resolve({ rows: [sequenceFeatureRow] }),
    );
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: sequenceFeatureRow.id,
      detail: sequenceFeatureRow,
      rows: [sequenceFeatureRow],
      selection: { [sequenceFeatureRow.id]: true },
      selectedIds: [sequenceFeatureRow.id],
    });

    render(
      <ResourceCollection
        profile={{
          resource: "sequence_feature",
          label: "Sequence Features",
          idField: "id",
          columns: [
            { id: "sf_name", label: "Name" },
            { id: "sf_id", label: "SFVT ID" },
          ],
          defaultSort: "sf_name:asc",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "sf_name:asc" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "sequence_feature",
      enabledActions: ["copyRows", "services"],
      disabledActions: undefined,
    });

    // Legacy runs no service from this tab, so SERVICES resolves nothing.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("sequence_feature", {
        ids: [sequenceFeatureRow.id],
        fields: ["sf_name", "sf_id"],
      });
    });
  });

  it("enables COPY, DWNLD and an empty SERVICES chooser for Epitopes", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const epitopeRow = {
      epitope_id: "15/780",
      epitope_sequence: "DRDLQTGGI",
      host_name: "Homo sapiens",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [epitopeRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: epitopeRow.epitope_id,
      detail: epitopeRow,
      rows: [epitopeRow],
      selection: { [epitopeRow.epitope_id]: true },
      selectedIds: [epitopeRow.epitope_id],
    });

    render(
      <ResourceCollection
        profile={{
          resource: "epitope",
          label: "Epitopes",
          idField: "epitope_id",
          columns: [
            { id: "epitope_sequence", label: "Epitope Sequence" },
            { id: "host_name", label: "Host" },
          ],
          defaultSort: "unsorted",
        }}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "epitope",
      enabledActions: ["copyRows", "services"],
      disabledActions: undefined,
    });

    // Legacy errors with "Missing or invalid type for Services" on this tab, so
    // SERVICES opens the chooser without resolving anything.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Epitope action" }));
    expect(open).toHaveBeenCalledWith(
      "/epitope/15%2F780",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("epitope", {
        ids: [epitopeRow.epitope_id],
        fields: ["epitope_sequence", "host_name"],
      });
    });
  });

  it("resolves Feature IDs for the SERVICES chooser and the Feature Group", async () => {
    const user = userEvent.setup();
    const featureRow = {
      feature_id: "canonical-feature",
      patric_id: "fig|83332.12.peg.1",
      genome_id: "83332.12",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [featureRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: featureRow.feature_id,
      detail: featureRow,
      rows: [featureRow],
      selection: { [featureRow.feature_id]: true },
      selectedIds: [featureRow.feature_id],
    });

    render(
      <ResourceCollection
        profile={featureCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "genome_feature",
      // FASTA and ID MAP stay on their not-ready tooltip.
      enabledActions: ["copyRows", "services", "group"],
      disabledActions: undefined,
    });

    await user.click(screen.getByRole("button", { name: "services" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("genome_feature", {
        ids: [featureRow.feature_id],
        fields: ["feature_id"],
      });
    });
    expect(await screen.findByTestId("selection-services")).toHaveAttribute(
      "data-kind",
      "feature",
    );
  });

  it("enables COPY ROWS and an empty SERVICES chooser for Domains and Motifs", async () => {
    const user = userEvent.setup();
    const featureRow = {
      id: "97bffc25",
      genome_id: "568815.3",
      patric_id: "fig|568815.3.peg.6",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [featureRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "97bffc25",
      detail: featureRow,
      rows: [featureRow],
      selection: { "97bffc25": true },
      selectedIds: ["97bffc25"],
    });

    render(
      <ResourceCollection
        profile={proteinFeatureCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "protein_feature",
      enabledActions: ["copyRows", "services"],
      disabledActions: undefined,
    });

    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("protein_feature", {
        ids: ["97bffc25"],
        fields: proteinFeatureCollectionProfile.columns.map(
          (column) => column.id,
        ),
      });
    });
  });

  it("enables COPY ROWS and an empty SERVICES chooser for Protein Structures", async () => {
    const user = userEvent.setup();
    const structureRow = {
      pdb_id: "AF-A0A502BNJ0-F1",
      genome_id: "215590.7",
      patric_id: "fig|215590.7.peg.2721",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [structureRow] }));
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "AF-A0A502BNJ0-F1",
      detail: structureRow,
      rows: [structureRow],
      selection: { "AF-A0A502BNJ0-F1": true },
      selectedIds: ["AF-A0A502BNJ0-F1"],
    });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(
      <ResourceCollection
        profile={proteinStructureCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["copyRows", "services"],
      disabledActions: {
        genome: undefined,
        feature: undefined,
        structure: undefined,
      },
    });

    // No service accepts structures, so SERVICES reports it without resolving rows.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Structure action" }));
    expect(open).toHaveBeenCalledWith(
      "/protein-structure?accession=AF-A0A502BNJ0-F1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("exports the selected Protein Structures from the Download action", async () => {
    const user = userEvent.setup();
    // Plan item 21: this used to export through `repository()`, whose default
    // resolves the module's Genome fixture (`row`, with `genome_name`/`genome_length`)
    // regardless of the profile it is rendered under — a Protein Structure download
    // asserting on a Genome row. The repository here resolves a row shaped like the
    // rest of this suite's Protein Structure fixtures instead.
    const structureRow = { pdb_id: "1ABC", genome_id: "215590.7" };
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "1ABC",
      detail: structureRow,
      rows: [structureRow],
      selection: { "1ABC": true },
      selectedIds: ["1ABC"],
    });
    const selected = vi.fn(() => Promise.resolve({ rows: [structureRow] }));

    render(
      <ResourceCollection
        profile={proteinStructureCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(downloadResourceExport).toHaveBeenCalledWith(
        "protein_structure",
        [structureRow],
        proteinStructureCollectionProfile.columns,
        proteinStructureCollectionProfile.columns.map((column) => column.id),
        "csv",
        "all",
        "protein_structure",
      );
    });
  });

  it("keeps the Protein Structure member actions disabled without their identifiers", () => {
    const structureRow = { title: "Structure without identifiers" };
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: "structure-without-ids",
      detail: structureRow,
      rows: [structureRow],
      selection: { "structure-without-ids": true },
      selectedIds: ["structure-without-ids"],
    });

    render(
      <ResourceCollection
        profile={proteinStructureCollectionProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      enabledActions: ["copyRows", "services"],
      disabledActions: {
        genome: "No genome is associated with this structure",
        feature: "No feature is associated with this structure",
        structure: "A structure accession is required",
      },
    });
    // Plan item 21: the real bar disables rather than removes these buttons
    // (search-action-bar.tsx's `isDisabled`), so the fake renders them the same way —
    // present, with the native `disabled` attribute. `toBeDisabled()` proves each
    // destination is genuinely unreachable in the real UI's own terms, not just that a
    // click happens to have no effect.
    expect(screen.getByRole("button", { name: "Genome action" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Feature action" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Structure action" })).toBeDisabled();
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
      enabledActions: ["copyRows", "services", "genomes", "group"],
      disabledActions: {
        genomes: "No genomes are associated with this strain",
        services: "No genomes are associated with this strain",
        group: "No genomes are associated with this strain",
      },
    });
    // Plan item 21: both disabled ids are ones the fake gates on `enabledActions`, and
    // the real bar disables rather than removes a gated-off button, so both are still
    // present here — `toBeDisabled()` proves each is genuinely unreachable rather than
    // merely unclicked.
    expect(screen.getByRole("button", { name: "Genomes action" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "services" })).toBeDisabled();
  });

  it("enables DWNLD and an empty SERVICES chooser for Experiments", async () => {
    const user = userEvent.setup();
    const experimentRow = { exp_id: "00042", exp_title: "Fixture experiment" };
    const selected = vi.fn(() => Promise.resolve({ rows: [experimentRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: experimentRow.exp_id,
      detail: experimentRow,
      rows: [experimentRow],
      selection: { [experimentRow.exp_id]: true },
      selectedIds: [experimentRow.exp_id],
    });

    render(
      <ResourceCollection
        profile={experimentCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    // Legacy leaves COPY ROWS out of the experiment container and runs no service
    // from it, so SERVICES is the only owned action and it resolves nothing.
    expect(actionBarProps).toMatchObject({
      searchType: "experiment",
      enabledActions: ["services"],
      disabledActions: undefined,
    });

    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith(
        "experiment",
        expect.objectContaining({ ids: [experimentRow.exp_id] }),
      );
    });
  });

  it("enables COPY, DWNLD and an empty SERVICES chooser for Surveillance", async () => {
    const user = userEvent.setup();
    const surveillanceRow = {
      id: "surveillance-backend-901",
      sample_identifier: "sample/1",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [surveillanceRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: surveillanceRow.id,
      detail: surveillanceRow,
      rows: [surveillanceRow],
      selection: { [surveillanceRow.id]: true },
      selectedIds: [surveillanceRow.id],
    });

    render(
      <ResourceCollection
        profile={surveillanceCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "surveillance",
      enabledActions: ["copyRows", "services"],
      disabledActions: undefined,
      guideUrl: surveillanceCollectionProfile.guideUrl,
    });

    // Legacy errors with "Missing or invalid type for Services" on this tab, so
    // SERVICES opens the chooser without resolving anything.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith(
        "surveillance",
        expect.objectContaining({ ids: [surveillanceRow.id] }),
      );
    });
  });

  it("enables COPY, DWNLD and an empty SERVICES chooser for Serology", async () => {
    const user = userEvent.setup();
    const serologyRow = {
      id: "serology-backend-77",
      sample_identifier: "sample/7",
    };
    const selected = vi.fn(() => Promise.resolve({ rows: [serologyRow] }));
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: serologyRow.id,
      detail: serologyRow,
      rows: [serologyRow],
      selection: { [serologyRow.id]: true },
      selectedIds: [serologyRow.id],
    });

    render(
      <ResourceCollection
        profile={serologyCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    expect(actionBarProps).toMatchObject({
      searchType: "serology",
      enabledActions: ["copyRows", "services"],
      disabledActions: undefined,
      guideUrl: serologyCollectionProfile.guideUrl,
    });

    // Legacy errors with "Missing or invalid type for Services" on this tab, so
    // SERVICES opens the chooser without resolving anything.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("No selectable services")).toBeVisible();
    expect(selected).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download action" }));
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith(
        "serology",
        expect.objectContaining({ ids: [serologyRow.id] }),
      );
    });
  });
});

/**
 * The action surface each resource exposes, at the four selection states the bar
 * distinguishes: nothing selected, one row, several rows, and every matching row.
 * `useResourceCollectionActions` owns this table now, so adding a resource extends this
 * matrix instead of the shell's generic query, export and table code.
 *
 * Which entries are in scope is a property of the resource; only the count and the
 * download route change with the selection. Both are asserted for every resource so
 * a config entry cannot silently stop reaching the bar.
 */
const actionMatrixFixtures: {
  resource: DataResource;
  label: string;
  idField: string;
  rows: Record<string, unknown>[];
  enabledActions: string[];
  disabledActions?: Record<string, string | undefined>;
}[] = [
  {
    resource: "taxonomy",
    label: "Taxa",
    idField: "taxon_id",
    rows: [
      { taxon_id: "234", taxon_name: "Brucella" },
      { taxon_id: "235", taxon_name: "Brucella suis" },
    ],
    enabledActions: ["services", "taxonOverview", "genomes", "features"],
  },
  {
    resource: "strain",
    label: "Strains",
    idField: "id",
    rows: [
      { id: "strain-1", genome_ids: ["83332.12"] },
      { id: "strain-2", genome_ids: ["83332.13"] },
    ],
    enabledActions: ["copyRows", "services", "genomes", "group"],
  },
  {
    resource: "genome",
    label: "Genomes",
    idField: "genome_id",
    rows: [{ genome_id: "83332.12" }, { genome_id: "83332.13" }],
    enabledActions: ["copyRows", "services", "group"],
  },
  {
    resource: "genome_feature",
    label: "Features",
    idField: "feature_id",
    rows: [{ feature_id: "PATRIC.1" }, { feature_id: "PATRIC.2" }],
    enabledActions: ["copyRows", "services", "group"],
  },
  {
    resource: "genome_sequence",
    label: "Sequences",
    idField: "sequence_id",
    rows: [
      { sequence_id: "83332.12.con.0001", genome_id: "83332.12" },
      { sequence_id: "83332.12.con.0002", genome_id: "83332.12" },
    ],
    enabledActions: ["copyRows", "services", "group", "features"],
  },
  {
    resource: "protein_feature",
    label: "Domains and Motifs",
    idField: "id",
    rows: [
      { id: "pf-1", genome_id: "83332.12" },
      { id: "pf-2", genome_id: "83332.13" },
    ],
    enabledActions: ["copyRows", "services"],
  },
  {
    resource: "protein_structure",
    label: "Protein Structures",
    idField: "pdb_id",
    rows: [
      { pdb_id: "1ABC", genome_id: "83332.12", feature_id: "PATRIC.1" },
      { pdb_id: "2ABC", genome_id: "83332.13", feature_id: "PATRIC.2" },
    ],
    enabledActions: ["copyRows", "services"],
    // Present with no reason: the structure's members are all reachable, but the
    // policy still reports on all three entries it owns.
    disabledActions: {
      genome: undefined,
      feature: undefined,
      structure: undefined,
    },
  },
  {
    resource: "sequence_feature",
    label: "Sequence Features",
    idField: "id",
    rows: [{ id: "sfvt-1" }, { id: "sfvt-2" }],
    enabledActions: ["copyRows", "services"],
  },
  {
    resource: "epitope",
    label: "Epitopes",
    idField: "epitope_id",
    rows: [{ epitope_id: "EPI-1" }, { epitope_id: "EPI-2" }],
    enabledActions: ["copyRows", "services"],
  },
  {
    resource: "serology",
    label: "Serology",
    idField: "id",
    rows: [{ id: "sero-1" }, { id: "sero-2" }],
    enabledActions: ["copyRows", "services"],
  },
  {
    resource: "surveillance",
    label: "Surveillance",
    idField: "id",
    rows: [{ id: "surv-1" }, { id: "surv-2" }],
    enabledActions: ["copyRows", "services"],
  },
  {
    resource: "ppi",
    label: "Interactions",
    idField: "id",
    rows: [
      { id: "ppi-1", feature_id_a: "A1", feature_id_b: "B1" },
      { id: "ppi-2", feature_id_a: "A2", feature_id_b: "B2" },
    ],
    enabledActions: ["copyRows", "services", "ppiFeatures", "group"],
  },
  {
    resource: "experiment",
    label: "Experiments",
    idField: "exp_id",
    rows: [{ exp_id: "00042" }, { exp_id: "00051" }],
    enabledActions: ["services"],
  },
  {
    resource: "bioset",
    label: "Biosets",
    idField: "bioset_id",
    rows: [
      { bioset_id: "bioset-1", exp_id: "00042" },
      { bioset_id: "bioset-2", exp_id: "00051" },
    ],
    enabledActions: ["services", "biosets"],
  },
];

/** Rows matching the query, so an all-pages selection reports a count of its own. */
const actionMatrixTotal = 7;

describe.each(actionMatrixFixtures)(
  "useResourceCollectionActions $resource selection states",
  ({ resource, label, idField, rows, enabledActions, disabledActions }) => {
    const ids = rows.map((row) => String(row[idField]));
    const selectionStates = [
      { name: "no selection", selectedIds: [], isAllPagesSelected: false, count: 0 },
      { name: "one row", selectedIds: [ids[0]], isAllPagesSelected: false, count: 1 },
      { name: "several rows", selectedIds: ids, isAllPagesSelected: false, count: 2 },
      {
        name: "every matching row",
        selectedIds: [],
        isAllPagesSelected: true,
        count: actionMatrixTotal,
      },
    ];

    it.each(selectionStates)(
      "reports the $name action surface and download route",
      async ({ selectedIds, isAllPagesSelected, count }) => {
        const user = userEvent.setup();
        const exportAll = vi.fn(() => Promise.resolve({ rows }));
        const selected = vi.fn(() => Promise.resolve({ rows }));
        useResourceCollection.mockReturnValue({
          ...collectionResult(),
          activeId: ids[0],
          detail: rows[0],
          rows,
          selection: Object.fromEntries(
            selectedIds.map((id) => [id, true as const]),
          ),
          selectedIds,
          isAllPagesSelected,
          total: actionMatrixTotal,
          sorting: [],
        });

        render(
          <ResourceCollection
            profile={{
              resource,
              label,
              idField,
              columns: Object.keys(rows[0]).map((id) => ({ id, label: id })),
              defaultSort: `${idField}:asc`,
            }}
            repository={
              { exportAll, selected } as unknown as DataRepository
            }
            state={{ filters: {}, page: 1, sort: `${idField}:asc` }}
            onStateChange={vi.fn()}
            showHeader={false}
          />,
        );

        expect(actionBarProps).toMatchObject({
          searchType: resource,
          selectedCount: count,
          enabledActions,
        });
        // Strict: the protein-structure policy reports keys with no reason, and
        // `toEqual` would treat that object as equal to `undefined`.
        expect(actionBarProps.disabledActions).toStrictEqual(disabledActions);

        await user.click(screen.getByRole("button", { name: "Download action" }));
        if (count === 0) {
          // An empty selection has nothing to export, so neither request is made.
          expect(selected).not.toHaveBeenCalled();
          expect(exportAll).not.toHaveBeenCalled();
          return;
        }
        if (isAllPagesSelected) {
          await waitFor(() => {
            expect(exportAll).toHaveBeenCalledWith(
              resource,
              expect.objectContaining({ sort: { field: idField, direction: "asc" } }),
            );
          });
          expect(selected).not.toHaveBeenCalled();
          return;
        }
        await waitFor(() => {
          expect(selected).toHaveBeenCalledWith(
            resource,
            expect.objectContaining({ ids: selectedIds }),
          );
        });
        expect(exportAll).not.toHaveBeenCalled();
      },
    );
  },
);

describe("useResourceCollectionActions error integration", () => {
  it("returns an owned action's failure to the collection shell and clears it on the next run", async () => {
    const user = userEvent.setup();
    const selected = vi
      .fn()
      .mockRejectedValueOnce(new Error("Data service is unavailable (503)"))
      .mockResolvedValue({ rows: [{ genome_id: "83332.12" }] });
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [{ genome_id: "83332.12" }],
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={{ selected } as unknown as DataRepository}
        state={{
          keyword: "coli",
          filters: { genome_status: ["Complete"] },
          page: 3,
          sort: "genome_length:desc",
        }}
        onStateChange={vi.fn()}
        showHeader={false}
      />,
    );

    // SERVICES is dispatched by CollectionSelectionActions, so its failure has to
    // cross both the actions boundary and the shell to be seen at all.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByText("Could not complete action")).toBeVisible();
    // The repository's own message reaches the user rather than a generic one.
    expect(
      screen.getByText("Data service is unavailable (503)"),
    ).toBeVisible();
    expect(screen.queryByTestId("selection-services")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "services" }));
    expect(await screen.findByTestId("selection-services")).toBeVisible();
    expect(
      screen.queryByText("Could not complete action"),
    ).not.toBeInTheDocument();
  });
});
