import { render, screen } from "@testing-library/react";

import TaxonomyPage from "../page";
import { TaxonomyNotFoundError } from "@/lib/services/organisms/taxonomy";

const { fetchOrganismTaxonomyMock, metadataSpy, notFoundSpy } = vi.hoisted(
  () => ({
    fetchOrganismTaxonomyMock: vi.fn(),
    metadataSpy: vi.fn(),
    notFoundSpy: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }),
);

vi.mock("@/lib/services/organisms/taxonomy", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/organisms/taxonomy")
  >("@/lib/services/organisms/taxonomy");
  return {
    ...actual,
    fetchOrganismTaxonomy: (...args: unknown[]) =>
      fetchOrganismTaxonomyMock(...args) as unknown,
  };
});

const bacterialTaxon = {
  taxonId: 234,
  taxonName: "Brucella",
  lineageNames: ["Bacteria", "Pseudomonadota", "Brucella"],
  lineageIds: [2, 1224, 234],
  taxonRank: "genus",
  genomes: 1909,
};

const viralTaxon = {
  taxonId: 11320,
  taxonName: "Influenza A virus",
  lineageNames: ["Viruses", "Orthomyxoviridae", "Influenza A virus"],
  lineageIds: [10239, 11308, 11320],
  taxonRank: "species",
  genomes: 1834418,
};

beforeEach(() => {
  fetchOrganismTaxonomyMock.mockResolvedValue(bacterialTaxon);
});

vi.mock(
  "@/components/organisms/metadata-distributions/metadata-distributions",
  () => ({
    MetadataDistributions: (props: Record<string, unknown>) => {
      metadataSpy(props);
      return <div data-testid="metadata-distributions" />;
    },
  }),
);

// The taxonomy tree view client-fetches via TanStack Query and renders inside
// ResourceWorkspace (react-resizable-panels needs ResizeObserver, absent in jsdom). Its
// behavior is covered by taxonomy-tree.test.tsx; here we only assert the page wires
// it under tab=taxa-tree, so stub the factory to a plain marker.
vi.mock("@/components/organisms/taxon-views/taxonomy-tree-view", () => ({
  makeTaxonomyTreeView: () =>
    function TaxonomyTreeView() {
      return <div data-testid="taxonomy-tree" />;
    },
}));

// The sequences view renders ResourceChildCollection — TanStack Query through
// useResourceCollection, plus ResourceWorkspace's react-resizable-panels — and is
// covered by view-factories.test.tsx. Stub the factory here so this page-level
// test stays focused on routing/wiring, not TanStack Query provider setup.
vi.mock("@/components/organisms/taxon-views/sequences", () => ({
  makeSequencesView: () =>
    function SequencesView() {
      return <div data-testid="sequences-view" />;
    },
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundSpy(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/taxonomy/234",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

describe("TaxonomyPage", () => {
  it("renders the heading for Brucella", async () => {
    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "234" }),
      searchParams: Promise.resolve({ tab: "taxa-tree" }),
    });

    render(node);

    expect(
      screen.getByRole("heading", { level: 1, name: "Brucella" }),
    ).toBeInTheDocument();
  });

  it("renders the taxonomy tree view when tab=taxa-tree", async () => {
    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "234" }),
      searchParams: Promise.resolve({ tab: "taxa-tree" }),
    });

    render(node);

    expect(screen.getByTestId("taxonomy-tree")).toBeInTheDocument();
  });

  it("renders the sequences view when tab=sequences", async () => {
    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "234" }),
      searchParams: Promise.resolve({ tab: "sequences" }),
    });

    render(node);

    expect(screen.getByTestId("sequences-view")).toBeInTheDocument();
    // No placeholder — sequences is a real view now.
    expect(screen.queryByText(/This view is coming soon/)).toBeNull();
  });

  it("shows Interactions disabled (not removed) for viral taxa", async () => {
    fetchOrganismTaxonomyMock.mockResolvedValueOnce(viralTaxon);
    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "11320" }),
      searchParams: Promise.resolve({}),
    });

    render(node);

    // Present in the desktop rail, now rendered disabled rather than omitted.
    const interactionsButtons = screen.getAllByRole("button", {
      name: /Interactions/,
    });
    expect(interactionsButtons.length).toBeGreaterThan(0);
    expect(
      interactionsButtons.some(
        (b) => b.getAttribute("aria-disabled") === "true",
      ),
    ).toBe(true);
  });

  it("calls notFound for non-numeric taxonId", async () => {
    notFoundSpy.mockClear();
    await expect(
      TaxonomyPage({
        params: Promise.resolve({ taxonId: "not-a-number" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalled();
  });

  it("calls notFound for negative taxonId", async () => {
    notFoundSpy.mockClear();
    await expect(
      TaxonomyPage({
        params: Promise.resolve({ taxonId: "-5" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalled();
  });

  it("calls notFound for taxonId of 0", async () => {
    notFoundSpy.mockClear();
    await expect(
      TaxonomyPage({
        params: Promise.resolve({ taxonId: "0" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalled();
  });

  it("passes showAmr=true for bacterial taxa", async () => {
    metadataSpy.mockClear();
    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "234" }),
      searchParams: Promise.resolve({}),
    });
    render(node);

    expect(metadataSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showAmr: true }),
    );
  });

  it("passes showAmr=false for viral taxa", async () => {
    fetchOrganismTaxonomyMock.mockResolvedValueOnce(viralTaxon);
    metadataSpy.mockClear();

    const node = await TaxonomyPage({
      params: Promise.resolve({ taxonId: "11320" }),
      searchParams: Promise.resolve({}),
    });
    render(node);

    expect(metadataSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showAmr: false }),
    );
  });

  it("calls notFound when fetchOrganismTaxonomy throws TaxonomyNotFoundError", async () => {
    notFoundSpy.mockClear();
    fetchOrganismTaxonomyMock.mockRejectedValueOnce(
      new TaxonomyNotFoundError(999),
    );

    await expect(
      TaxonomyPage({
        params: Promise.resolve({ taxonId: "999" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalled();
  });

  it("re-throws when fetchOrganismTaxonomy throws a non-404 error", async () => {
    notFoundSpy.mockClear();
    fetchOrganismTaxonomyMock.mockRejectedValueOnce(new Error("upstream 500"));

    await expect(
      TaxonomyPage({
        params: Promise.resolve({ taxonId: "999" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("upstream 500");
    expect(notFoundSpy).not.toHaveBeenCalled();
  });
});
