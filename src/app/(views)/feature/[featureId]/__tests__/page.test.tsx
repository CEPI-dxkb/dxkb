import { act, render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";
import { createQueryClientWrapper } from "@/test-helpers/react";

const mocks = vi.hoisted(() => ({
  getFeature: vi.fn(),
  getTaxonomy: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
  redirect: mocks.redirect,
  usePathname: () => "/feature/PATRIC.1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/feature-view/server", () => ({ getFeature: mocks.getFeature }));
vi.mock("@/lib/taxonomy-view/server", () => ({
  getTaxonomy: mocks.getTaxonomy,
}));

interface ResourceChildCollectionProps {
  resource: string;
  idField: string;
  label: string;
  rql: string;
}

function ResourceChildCollection({
  resource,
  idField,
  label,
  rql,
}: ResourceChildCollectionProps) {
  return (
    <div
      data-testid="resource-collection"
      data-resource={resource}
      data-id-field={idField}
      data-rql={rql}
    >
      {label}
    </div>
  );
}

vi.mock("@/components/views", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/views")>();
  return {
    ...original,
    ResourceChildCollection,
  };
});

vi.mock("@/components/compare-region", () => ({
  CompareRegionPanel: ({ patricId }: { patricId: string }) => (
    <div data-testid="compare-region" data-peg={patricId} />
  ),
}));

import FeaturePage, { generateMetadata } from "../page";

const feature = {
  feature_id: "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
  patric_id: "fig|1282460.2049.peg.1",
  genome_id: "1282460.2049",
  genome_name: "MERS-CoV",
  taxon_id: 1335626,
  annotation: "PATRIC",
  feature_type: "CDS",
  location: "1..100",
  product: "replicase polyprotein",
};

describe("Feature member route", () => {
  beforeEach(() => {
    mocks.getFeature.mockReset();
    mocks.notFound.mockClear();
    mocks.permanentRedirect.mockClear();
    mocks.redirect.mockClear();
    mocks.getFeature.mockResolvedValue({ feature, usedAlternateId: false });
    mocks.getTaxonomy.mockReset();
    mocks.getTaxonomy.mockResolvedValue(null);
  });

  it("leads with BV-BRC's lineage breadcrumb and identifier line", async () => {
    mocks.getFeature.mockResolvedValue({
      feature: { ...feature, refseq_locus_tag: "MERS_RS00005", gene: "orf1ab" },
      usedAlternateId: false,
    });
    mocks.getTaxonomy.mockResolvedValue({
      taxon_id: "1335626",
      lineage_ids: [10239, 2559587, 2732408, 11118, 694002, 1335626],
      lineage_names: [
        "Viruses",
        "Riboviria",
        "Pisuviricota",
        "Coronaviridae",
        "Betacoronavirus",
        "MERS-related coronavirus",
      ],
      lineage_ranks: [
        "acellular root",
        "realm",
        "phylum",
        "family",
        "genus",
        "species",
      ],
    });
    const page = await FeaturePage({
      params: Promise.resolve({ featureId: feature.feature_id }),
      searchParams: Promise.resolve({}),
    });
    // The lineage streams in behind a Suspense boundary; let it land.
    await act(async () => {
      render(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.getTaxonomy).toHaveBeenCalledWith("1335626");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: feature.patric_id,
    });
    const breadcrumb = heading.parentElement?.previousElementSibling;
    expect(
      [...(breadcrumb?.querySelectorAll("a") ?? [])].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    ).toEqual([
      ["Pisuviricota", "/taxonomy/2732408"],
      ["Coronaviridae", "/taxonomy/11118"],
      ["Betacoronavirus", "/taxonomy/694002"],
      ["MERS-related coronavirus", "/taxonomy/1335626"],
      ["MERS-CoV", "/genome/1282460.2049"],
    ]);
    expect(heading.parentElement).toHaveTextContent(
      `${feature.patric_id}|MERS_RS00005|orf1ab|replicase polyprotein`,
    );
    expect(screen.queryByRole("link", { name: "Features" })).toBeNull();
  });

  it("keeps the genome breadcrumb when the taxonomy lookup fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.getTaxonomy.mockRejectedValue(new Error("Taxonomy unavailable"));
    const page = await FeaturePage({
      params: Promise.resolve({ featureId: feature.feature_id }),
      searchParams: Promise.resolve({}),
    });
    await act(async () => {
      render(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      screen.getByRole("heading", { level: 1, name: feature.patric_id }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "MERS-CoV" })[0],
    ).toHaveAttribute("href", "/genome/1282460.2049");
    expect(consoleError).toHaveBeenCalledWith(
      `feature/${feature.feature_id}: taxonomy/1335626 lookup failed`,
      expect.objectContaining({ message: "Taxonomy unavailable" }),
    );
    consoleError.mockRestore();
  });

  it("shows the feature without waiting for its lineage", async () => {
    // A stalled taxonomy lookup runs to the Data API's 20 s budget; the
    // record has loaded by then, so only the breadcrumb's taxa wait for it.
    mocks.getTaxonomy.mockReturnValue(new Promise(() => undefined));
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: feature.patric_id }),
    ).toBeInTheDocument();
    expect(screen.getByText("Genome and source")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "MERS-CoV" })[0],
    ).toHaveAttribute("href", "/genome/1282460.2049");
  });

  it("renders the grouped overview and metadata", async () => {
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { name: feature.patric_id }),
    ).toBeInTheDocument();
    expect(screen.getByText("Genome and source")).toBeInTheDocument();
    expect(screen.getByText("Location and sequence")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "MERS-CoV" })).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "MERS-CoV" })[0],
    ).toHaveAttribute("href", "/genome/1282460.2049");
    expect(
      await generateMetadata({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    ).toMatchObject({ title: `${feature.patric_id} | Feature` });
  });

  it("offers the feature's sequence downloads in the header", async () => {
    mocks.getFeature.mockResolvedValue({
      feature: { ...feature, na_length: 100, aa_length: 33 },
      usedAlternateId: false,
    });
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
      { wrapper: createQueryClientWrapper() },
    );
    expect(
      screen.getByRole("button", { name: "DNA FASTA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Protein FASTA" }),
    ).toBeInTheDocument();
  });

  it("offers no download for a record with no sequence", async () => {
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.queryByRole("button", { name: /FASTA/ }),
    ).not.toBeInTheDocument();
  });

  it("names a feature without a BRC ID by a public identifier, not its key", async () => {
    const { patric_id: _omitted, ...withoutBrcId } = feature;
    mocks.getFeature.mockResolvedValue({
      feature: { ...withoutBrcId, refseq_locus_tag: "MERS_RS00005" },
      usedAlternateId: false,
    });
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "MERS_RS00005" }),
    ).toBeInTheDocument();
    expect(
      await generateMetadata({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({}),
      }),
    ).toMatchObject({ title: "MERS_RS00005 | Feature" });
  });

  it("resolves one identifier from both entry points for a percent-bearing ID", async () => {
    // The two entry points receive DIFFERENT encodings of the same segment:
    // the page component gets `encodeURIComponent(id)`, `generateMetadata`
    // gets the matcher's decoded `id`. `loadFeature` used to decode both, so
    // an id containing a literal percent escape resolved to a different
    // record in the title than in the body. Feeding both the same string
    // cannot catch that — each gets what Next actually gives it.
    const percentId = "fig|1282460.2049.peg.1%2F5";
    mocks.getFeature.mockResolvedValue({
      feature: { ...feature, patric_id: percentId },
      usedAlternateId: false,
    });

    await FeaturePage({
      params: Promise.resolve({ featureId: encodeURIComponent(percentId) }),
      searchParams: Promise.resolve({}),
    });
    await generateMetadata({
      params: Promise.resolve({ featureId: percentId }),
      searchParams: Promise.resolve({}),
    });

    const requestedIds = mocks.getFeature.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(requestedIds).toEqual([percentId, percentId]);
  });

  it("renders exact-feature interactions", async () => {
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({ tab: "interactions" }),
      }),
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-rql",
      `and(or(eq(feature_id_a,${feature.feature_id}),eq(feature_id_b,${feature.feature_id})),eq(evidence,experimental))`,
    );
  });

  it("renders exact-feature domains and motifs", async () => {
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({ tab: "domains" }),
      }),
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-resource",
      "protein_feature",
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-id-field",
      "id",
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-rql",
      `eq(feature_id,${feature.feature_id})`,
    );
  });

  it("redirects invalid tabs on the server and preserves other parameters", async () => {
    await expect(
      FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({ tab: "missing", source: "search" }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/feature/${feature.feature_id}?source=search`,
    );
  });

  it("permanently redirects a PATRIC ID lookup to feature_id", async () => {
    mocks.getFeature.mockResolvedValue({ feature, usedAlternateId: true });
    // The exact target: no query, so no trailing "?".
    await expect(
      FeaturePage({
        params: Promise.resolve({ featureId: feature.patric_id }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(new Error(`NEXT_REDIRECT:/feature/${feature.feature_id}`));
  });

  it("opens the Compare Region Viewer on the feature's BRC ID", async () => {
    render(
      await FeaturePage({
        params: Promise.resolve({ featureId: feature.feature_id }),
        searchParams: Promise.resolve({ tab: "compare-region" }),
      }),
    );
    expect(screen.getByTestId("compare-region")).toHaveAttribute(
      "data-peg",
      feature.patric_id,
    );
  });

  it("keeps the query when it redirects a BRC ID to the feature's own URL", async () => {
    mocks.getFeature.mockResolvedValue({ feature, usedAlternateId: true });
    await expect(
      FeaturePage({
        params: Promise.resolve({
          featureId: encodeURIComponent(feature.patric_id),
        }),
        searchParams: Promise.resolve({
          tab: "compare-region",
          "compare.genomes": "20",
        }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/feature/${feature.feature_id}?tab=compare-region&compare.genomes=20`,
    );
  });

  it("uses notFound for absent, inaccessible, and ambiguous records", async () => {
    mocks.getFeature.mockResolvedValue({
      feature: null,
      usedAlternateId: false,
    });
    await expect(
      FeaturePage({
        params: Promise.resolve({ featureId: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getFeature.mockRejectedValue(
      new DataApiError("Multiple records", 409, "ambiguous_member"),
    );
    await expect(
      FeaturePage({
        params: Promise.resolve({ featureId: "ambiguous" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream failures", async () => {
    mocks.getFeature.mockRejectedValue(
      new Error("Feature backend unavailable"),
    );
    await expect(
      FeaturePage({
        params: Promise.resolve({ featureId: "PATRIC.1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Feature backend unavailable");
  });
});
