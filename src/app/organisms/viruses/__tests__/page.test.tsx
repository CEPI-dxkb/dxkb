import { render, screen } from "@testing-library/react";

import VirusesPage from "../page";

const { fetchTaxonomy } = vi.hoisted(() => ({ fetchTaxonomy: vi.fn() }));

vi.mock("@/lib/services/organisms/taxonomy", () => ({
  fetchOrganismTaxonomy: (taxonId: number) => fetchTaxonomy(taxonId) as unknown,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/organisms/viruses",
  useSearchParams: () => new URLSearchParams(),
}));
interface CollectionProps {
  baseRql: string;
}

function FeatureResourceCollection({ baseRql }: CollectionProps) {
  return <div>{`genome_feature:${baseRql}`}</div>;
}

function GenomeResourceCollection({ baseRql }: CollectionProps) {
  return <div>{`genome:${baseRql}`}</div>;
}

vi.mock("@/components/views", () => ({
  FeatureResourceCollection,
  GenomeResourceCollection,
  ResourceChildCollection: ({ resource, rql }: { resource: string; rql: string }) => (
    <div>{`${resource}:${rql}`}</div>
  ),
}));
vi.mock("@/components/taxonomy/taxonomy-tree-panel", () => ({
  TaxonomyTreePanel: ({ taxa }: { taxa: { taxonName: string }[] }) => (
    <div>{`${taxa.map((taxon) => taxon.taxonName).join(", ")} tree`}</div>
  ),
}));
vi.mock("@/components/organisms/virus-families/virus-families-section", () => ({
  VirusFamiliesSection: () => <div>Viral overview</div>,
}));

beforeEach(() => {
  fetchTaxonomy.mockResolvedValue({ taxonId: 10239, taxonName: "Viruses" });
});

describe("VirusesPage", () => {
  it("fetches the viral root and wires its overview into the real view registry", async () => {
    render(await VirusesPage({ searchParams: Promise.resolve({}) }));
    expect(fetchTaxonomy).toHaveBeenCalledWith(10239);
    expect(screen.getByText("Viral overview")).toBeInTheDocument();
  });

  it("supports legacy ?view= when ?tab= is absent", async () => {
    render(await VirusesPage({ searchParams: Promise.resolve({ view: "features" }) }));
    expect(
      screen.getByText(
        "genome_feature:and(eq(genome_id,*),genome(and(eq(taxon_lineage_ids,10239),ne(genome_status,Deprecated))),eq(annotation,PATRIC))",
      ),
    ).toBeInTheDocument();
  });

  it("prefers ?tab= over ?view=", async () => {
    render(
      await VirusesPage({
        searchParams: Promise.resolve({ tab: "taxa-tree", view: "features" }),
      }),
    );
    expect(screen.getByText("Viruses tree")).toBeInTheDocument();
    expect(screen.queryByText(/^genome_feature:/)).not.toBeInTheDocument();
  });
});
