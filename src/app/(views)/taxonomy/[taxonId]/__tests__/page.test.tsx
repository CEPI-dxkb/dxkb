import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";

import TaxonomyPage from "../page";
import { TaxonomyNotFoundError } from "@/lib/services/organisms/taxonomy";
import { server } from "@/test-helpers/msw-server";
import { connectTimeout, maintenancePage } from "@/test-helpers/upstream-failures";

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

// The sequences view renders ResourceChildCollection, whose real implementation needs
// a TanStack Query provider and nests ResourceWorkspace; react-resizable-panels also
// needs ResizeObserver, which jsdom lacks. The factory, collection, and workspace have
// focused tests, so stub the factory here to keep this test on tab routing/wiring.
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

  describe("when the taxonomy lookup fails upstream", () => {
    const baseUrl = "https://bvbrc.test/api-for-website";

    beforeEach(async () => {
      process.env.BVBRC_WEBSITE_API_URL = baseUrl;
      // Route the lookup through the real fetch, so MSW plays the backend.
      const actual = await vi.importActual<
        typeof import("@/lib/services/organisms/taxonomy")
      >("@/lib/services/organisms/taxonomy");
      fetchOrganismTaxonomyMock.mockImplementation(actual.fetchOrganismTaxonomy);
      notFoundSpy.mockClear();
    });

    afterEach(() => {
      delete process.env.BVBRC_WEBSITE_API_URL;
    });

    it("renders the shell with the condensed cause instead of throwing", async () => {
      server.use(http.get(`${baseUrl}/taxonomy/1773`, () => maintenancePage()));

      render(
        await TaxonomyPage({
          params: Promise.resolve({ taxonId: "1773" }),
          searchParams: Promise.resolve({ tab: "genomes" }),
        }),
      );

      expect(
        screen.getByRole("heading", { level: 1, name: "Taxon 1773" }),
      ).toBeInTheDocument();
      const alert = screen.getByRole("alert");
      expect(
        within(alert).getByRole("heading", { name: "Taxon 1773 could not be loaded" }),
      ).toBeInTheDocument();
      // The maintenance page's status and title, never its HTML.
      expect(alert).toHaveTextContent(/503/);
      expect(alert).toHaveTextContent(/Site Maintenance/);
      expect(alert).not.toHaveTextContent("<");
      expect(within(alert).getByRole("button", { name: "Retry" })).toBeEnabled();
      expect(within(alert).getByRole("link", { name: "Browse taxa" })).toHaveAttribute(
        "href",
        "/taxonomy",
      );
      expect(notFoundSpy).not.toHaveBeenCalled();
    });

    it("names the unreachable service for a network failure", async () => {
      server.use(
        http.get(`${baseUrl}/taxonomy/561`, () => {
          throw connectTimeout();
        }),
      );

      render(
        await TaxonomyPage({
          params: Promise.resolve({ taxonId: "561" }),
          searchParams: Promise.resolve({}),
        }),
      );

      // The cause, not undici's bare "fetch failed".
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        /did not respond \(connection timed out after 10 s\)/,
      );
      expect(alert).not.toHaveTextContent("fetch failed");
    });

    it("keeps notFound for a missing taxon", async () => {
      server.use(
        http.get(`${baseUrl}/taxonomy/999999999`, () =>
          new Response("not found", { status: 404 }),
        ),
      );

      await expect(
        TaxonomyPage({
          params: Promise.resolve({ taxonId: "999999999" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("throws a configuration error to the boundary instead of rendering its env var name", async () => {
      delete process.env.BVBRC_WEBSITE_API_URL;

      await expect(
        TaxonomyPage({
          params: Promise.resolve({ taxonId: "1773" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("Missing required environment variable: BVBRC_WEBSITE_API_URL");
    });

    it("throws a malformed payload (a bug, not an outage) to the boundary", async () => {
      server.use(
        http.get(`${baseUrl}/taxonomy/1773`, () =>
          HttpResponse.json({ taxon_id: 1773 }),
        ),
      );

      await expect(
        TaxonomyPage({
          params: Promise.resolve({ taxonId: "1773" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("Unexpected BV-BRC response shape: taxon_name is missing");
    });
  });
});
