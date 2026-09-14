import { render, screen } from "@testing-library/react";
import { proteinFeatureRql } from "@/lib/views/child-resources";
import { GenomeCollection } from "../genome-collection";
import type { CollectionState } from "@/lib/views/collection-state";

interface ShellProps {
  viewLabel: string;
  title: string;
  layout: string;
  activeTab: string;
  defaultTab: string;
  tabs: { key: string; label: string; enabled?: boolean }[];
  children: React.ReactNode;
}

interface ChildProps {
  resource: string;
  label: string;
  idField: string;
  rql: string;
  defaultSort: string;
  columns?: unknown;
  profile?: unknown;
  keywordMode?: string;
}

const { childProps, searchParams, shellProps } = vi.hoisted(() => ({
  childProps: { current: null as ChildProps | null },
  searchParams: { current: new URLSearchParams("rql=in(genome_id,(1.1,1.2))") },
  shellProps: { current: null as ShellProps | null },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/genome",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams.current,
}));
vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: vi.fn() }));
vi.mock("@/components/views", () => ({
  EntityViewShell: (props: ShellProps) => {
    shellProps.current = props;
    return (
      <div>
        {props.tabs.map((tab) => (
          <button key={tab.key} disabled={tab.enabled === false}>
            {tab.label}
          </button>
        ))}
        <span data-testid="active-tab">{props.activeTab}</span>
        {props.children}
      </div>
    );
  },
  GenomeResourceCollection: () => <div>Genome rows</div>,
  FeatureResourceCollection: ({ baseRql }: { baseRql: string }) => (
    <div data-testid="feature-rql">{baseRql}</div>
  ),
  ProteinFeatureResourceCollection: () => <div>Domain rows</div>,
  ProteinStructureResourceCollection: () => <div>Structure rows</div>,
  ResourceChildCollection: (props: ChildProps) => {
    childProps.current = props;
    return (
      <div data-testid="child-collection" data-keyword-mode={props.keywordMode}>
        {props.rql}
      </div>
    );
  },
}));

const initialState: CollectionState = {
  rql: "in(genome_id,(1.1,1.2))",
  filters: {},
  page: 1,
  sort: "unsorted",
};

/** What `/genome` means with no query of its own. */
const recentScope =
  "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))";

describe("GenomeCollection", () => {
  beforeEach(() => {
    childProps.current = null;
    shellProps.current = null;
    searchParams.current = new URLSearchParams("rql=in(genome_id,(1.1,1.2))");
  });

  it("shows the legacy Genome List tabs and keeps unsupported tabs disabled", () => {
    render(<GenomeCollection initialState={initialState} />);

    expect(screen.getByRole("button", { name: "Genomes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sequences" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Features" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Proteins" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Protein Structures" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Domains and Motifs" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Overview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Strains" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Epitopes" })).toBeDisabled();
  });

  it("hands the view shell the tab set it owns and defaults to Genomes", () => {
    searchParams.current = new URLSearchParams("rql=in(genome_id,(1.1,1.2))");

    render(<GenomeCollection initialState={initialState} />);

    // Tab URL construction and parameter preservation belong to EntityViewShell
    // and are covered by its own suite; GenomeCollection only contributes the tab
    // set, the resolved active tab and the default.
    expect(shellProps.current).toEqual(
      expect.objectContaining({
        viewLabel: "Genome View",
        title: "Genomes",
        layout: "fill",
        activeTab: "genomes",
        defaultTab: "genomes",
      }),
    );
    expect(
      shellProps.current?.tabs.map((tab) => [tab.key, tab.enabled !== false]),
    ).toEqual([
      ["overview", false],
      ["strains", false],
      ["genomes", true],
      ["sequences", true],
      ["features", true],
      ["proteins", true],
      ["structures", true],
      ["domains", true],
      ["epitopes", false],
      ["surveillance", false],
      ["serology", false],
    ]);
  });

  it("falls back to the Genomes tab for a disabled or unknown tab", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=epitopes",
    );

    render(<GenomeCollection initialState={initialState} />);

    expect(screen.getByTestId("active-tab")).toHaveTextContent("genomes");
    expect(childProps.current).toBeNull();
  });

  it("scopes a related tab to the selected genome query", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=sequences",
    );

    render(<GenomeCollection initialState={initialState} />);

    expect(screen.getByTestId("active-tab")).toHaveTextContent("sequences");
    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))))",
    );
  });

  it("scopes a related tab to the recent-genomes default on a bare URL", () => {
    searchParams.current = new URLSearchParams("tab=sequences");

    render(
      <GenomeCollection
        initialState={{ filters: {}, page: 1, sort: "unsorted" }}
      />,
    );

    expect(childProps.current?.rql).toBe(
      `and(eq(genome_id,*),genome(${recentScope}))`,
    );
  });

  it("keeps friendly filters in the child resource scope", () => {
    searchParams.current = new URLSearchParams(
      "taxon_id=561&genome_status=Complete&tab=sequences",
    );

    render(
      <GenomeCollection
        initialState={{
          ...initialState,
          rql: undefined,
          filters: { taxon_id: ["561"], genome_status: ["Complete"] },
        }}
      />,
    );

    expect(childProps.current?.rql).toBe(
      `and(eq(genome_id,*),genome(and(${recentScope},and(eq(taxon_lineage_ids,561),eq(genome_status,Complete)))))`,
    );
  });

  it("keeps repeated values of one friendly filter in the child resource scope", () => {
    searchParams.current = new URLSearchParams(
      "genome_status=Complete&genome_status=WGS&tab=sequences",
    );

    render(
      <GenomeCollection
        initialState={{
          ...initialState,
          rql: undefined,
          filters: { genome_status: ["Complete", "WGS"] },
        }}
      />,
    );

    expect(childProps.current?.rql).toBe(
      `and(eq(genome_id,*),genome(and(${recentScope},or(eq(genome_status,Complete),eq(genome_status,WGS)))))`,
    );
  });

  it("keeps the active refinement in the child resource scope", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&refine=coli&tab=sequences",
    );

    render(
      <GenomeCollection initialState={{ ...initialState, refine: "coli" }} />,
    );

    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(and(keyword(coli),in(genome_id,(1.1,1.2)))))",
    );
  });

  it("keeps the canonical keyword in the child resource scope", () => {
    searchParams.current = new URLSearchParams(
      "keyword=Escherichia%20coli&tab=sequences",
    );

    render(
      <GenomeCollection
        initialState={{ ...initialState, keyword: "Escherichia coli" }}
      />,
    );

    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(and(keyword(Escherichia coli),in(genome_id,(1.1,1.2)))))",
    );
  });

  it("keeps the active refinement alongside the recent-genomes default", () => {
    searchParams.current = new URLSearchParams("refine=coli&tab=sequences");

    render(
      <GenomeCollection
        initialState={{
          filters: {},
          page: 1,
          sort: "unsorted",
          refine: "coli",
        }}
      />,
    );

    expect(childProps.current?.rql).toBe(
      `and(eq(genome_id,*),genome(and(${recentScope},keyword(coli))))`,
    );
  });

  it("leaves a blank refinement out of the child resource scope", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=sequences",
    );

    render(
      <GenomeCollection initialState={{ ...initialState, refine: "   " }} />,
    );

    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))))",
    );
  });

  it("uses the shared protein predicate on the Proteins tab", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=proteins",
    );

    render(<GenomeCollection initialState={initialState} />);

    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))),and(or(eq(feature_type,CDS),eq(feature_type,mat_peptide)),eq(annotation,PATRIC)))",
    );
    // Same clause the member Proteins view and `filter=protein` use.
    expect(childProps.current?.rql).toContain(proteinFeatureRql);
  });

  it("leaves the Features tab unconstrained by feature type", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=features",
    );

    render(<GenomeCollection initialState={initialState} />);

    expect(childProps.current?.rql).toBe(
      "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))))",
    );
  });

  it("defers to the canonical protein-structure profile on the Structures tab", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=structures",
    );

    render(<GenomeCollection initialState={initialState} />);

    // No `columns` or `profile` override: ResourceChildCollection's
    // `protein_structure` branch supplies the collection profile, so the tab keeps
    // its detail fields, facets and pdb_id row links.
    expect(childProps.current).toEqual(
      expect.objectContaining({
        resource: "protein_structure",
        label: "Protein Structures",
        idField: "pdb_id",
        defaultSort: "unsorted",
        rql: "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))))",
      }),
    );
    expect(childProps.current?.columns).toBeUndefined();
    expect(childProps.current?.profile).toBeUndefined();
  });

  it.each(["sequences", "features", "proteins", "domains", "structures"])(
    "searches all pages of the %s tab on the server",
    (tab) => {
      searchParams.current = new URLSearchParams(
        `rql=in(genome_id,(1.1,1.2))&tab=${tab}`,
      );

      render(<GenomeCollection initialState={initialState} />);

      expect(screen.getByTestId("child-collection")).toHaveAttribute(
        "data-keyword-mode",
        "server",
      );
    },
  );
});
