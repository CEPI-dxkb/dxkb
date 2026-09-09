import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenomeCollection } from "../genome-collection";

const { push, searchParams } = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: { current: new URLSearchParams("rql=in(genome_id,(1.1,1.2))") },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/genome",
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams.current,
}));
vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: vi.fn() }));
vi.mock("@/components/views", () => ({
  EntityViewShell: ({
    tabs,
    activeTab,
    children,
  }: {
    tabs: { key: string; label: string; enabled?: boolean }[];
    activeTab: string;
    children: React.ReactNode;
  }) => (
    <div>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          disabled={tab.enabled === false}
          onClick={() => {
            push(`/genome?rql=in(genome_id,(1.1,1.2))&tab=${tab.key}`);
          }}
        >
          {tab.label}
        </button>
      ))}
      <span data-testid="active-tab">{activeTab}</span>
      {children}
    </div>
  ),
  GenomeResourceCollection: () => <div>Genome rows</div>,
  FeatureResourceCollection: ({ baseRql }: { baseRql: string }) => (
    <div data-testid="feature-rql">{baseRql}</div>
  ),
  ProteinFeatureResourceCollection: () => <div>Domain rows</div>,
  ProteinStructureResourceCollection: () => <div>Structure rows</div>,
  ResourceChildCollection: ({ rql }: { rql: string }) => (
    <div data-testid="sequence-rql">{rql}</div>
  ),
}));

const initialState = {
  rql: "in(genome_id,(1.1,1.2))",
  filters: {},
  page: 1,
  sort: "unsorted",
};

describe("GenomeCollection", () => {
  beforeEach(() => {
    push.mockReset();
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

  it("scopes a related tab to the selected genome query", () => {
    searchParams.current = new URLSearchParams(
      "rql=in(genome_id,(1.1,1.2))&tab=sequences",
    );

    render(<GenomeCollection initialState={initialState} />);

    expect(screen.getByTestId("active-tab")).toHaveTextContent("sequences");
    expect(screen.getByTestId("sequence-rql")).toHaveTextContent(
      "and(eq(genome_id,*),genome(in(genome_id,(1.1,1.2))))",
    );
  });

  it("preserves the selection query when changing tabs", async () => {
    render(<GenomeCollection initialState={initialState} />);

    await userEvent.click(screen.getByRole("button", { name: "Features" }));

    expect(push).toHaveBeenCalledWith(
      "/genome?rql=in(genome_id,(1.1,1.2))&tab=features",
    );
  });
});
