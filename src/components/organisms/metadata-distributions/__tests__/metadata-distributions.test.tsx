import { fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/services/organisms/metadata-facets", () => ({
  fetchOrganismMetadataFacets: vi.fn(),
}));

vi.mock("@/lib/services/organisms/taxonomic-distribution", () => ({
  fetchTaxonomicDistribution: vi.fn(),
}));

vi.mock("@/lib/services/organisms/amr-distribution", () => ({
  fetchAmrPhenotypeDistribution: vi.fn(),
}));

const amrSpy = vi.fn();

vi.mock("../amr-bar-stack-chart", () => ({
  AmrBarStackChart: (props: { title: string; data: unknown }) => {
    amrSpy(props);
    return <div data-testid="amr-chart" data-title={props.title} />;
  },
}));

import { MetadataDistributions } from "../metadata-distributions";
import { fetchOrganismMetadataFacets } from "@/lib/services/organisms/metadata-facets";
import { fetchTaxonomicDistribution } from "@/lib/services/organisms/taxonomic-distribution";
import { fetchAmrPhenotypeDistribution } from "@/lib/services/organisms/amr-distribution";
import { taxonomicDistributionSentinel } from "@/components/organisms/types";

const emptyTaxonomic = { genus: [], species: [] };

beforeEach(() => {
  vi.mocked(fetchTaxonomicDistribution).mockResolvedValue(emptyTaxonomic);
});

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("MetadataDistributions", () => {
  it("renders configured donut charts", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      genus: [{ name: "Escherichia", count: 20 }],
      host_name: [{ name: "Homo sapiens", count: 12 }],
    });

    await renderServer(
      MetadataDistributions({ taxonId: 2, fields: ["genus", "host_name"] }),
    );

    expect(screen.getByRole("img", { name: "Genus distribution" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Host Name distribution" })).toBeInTheDocument();
  });

  it("renders Taxonomic Distribution chart", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    vi.mocked(fetchTaxonomicDistribution).mockResolvedValueOnce({
      genus: [{ name: "Brucella", count: 100 }],
      species: [{ name: "Brucella abortus", count: 50 }],
    });

    await renderServer(MetadataDistributions({ taxonId: 234, fields: [] }));

    expect(fetchTaxonomicDistribution).toHaveBeenCalledWith(234);
    expect(screen.getByText("Taxonomic Distribution")).toBeInTheDocument();
  });

  it("still renders when the taxonomic distribution fetch fails and shows an inline error", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      genus: [{ name: "Brucella", count: 100 }],
    });
    vi.mocked(fetchTaxonomicDistribution).mockRejectedValueOnce(new Error("taxonomic boom"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderServer(MetadataDistributions({ taxonId: 234, fields: ["genus"] }));

    expect(screen.getByRole("img", { name: "Genus distribution" })).toBeInTheDocument();
    expect(screen.getByText("Taxonomic Distribution")).toBeInTheDocument();
    expect(screen.getByText(/Could not load: taxonomic boom/)).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("taxonomic boom"),
    );
    warnSpy.mockRestore();
  });

  it("renders the Taxonomic Distribution chart at the sentinel position and excludes the sentinel from the facets fetch", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      host_common_name: [{ name: "Human", count: 50 }],
    });
    vi.mocked(fetchTaxonomicDistribution).mockResolvedValueOnce({
      genus: [{ name: "Brucella", count: 100 }],
      species: [],
    });

    await renderServer(
      MetadataDistributions({
        taxonId: 42,
        fields: ["host_common_name", taxonomicDistributionSentinel],
      }),
    );

    expect(screen.getByText("Taxonomic Distribution")).toBeInTheDocument();
    // Sentinel must be stripped before hitting the facets API
    expect(fetchOrganismMetadataFacets).toHaveBeenCalledWith(42, ["host_common_name"]);
    // No duplicate — the fallback render at the end is suppressed when sentinel is present
    expect(screen.getAllByText("Taxonomic Distribution")).toHaveLength(1);
  });

  it("renders the sequencing_centers field with the 'Sequencing Centers' label", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      sequencing_centers: [{ name: "NCBI", count: 100 }],
    });

    await renderServer(
      MetadataDistributions({ taxonId: 1, fields: ["sequencing_centers"] }),
    );

    expect(
      screen.getByRole("img", { name: "Sequencing Centers distribution" }),
    ).toBeInTheDocument();
  });

  it("does not fetch or render the AMR chart by default", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    amrSpy.mockClear();

    await renderServer(MetadataDistributions({ taxonId: 1, fields: [] }));

    expect(fetchAmrPhenotypeDistribution).not.toHaveBeenCalled();
    expect(amrSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("amr-chart")).not.toBeInTheDocument();
  });

  it("fetches and renders the AMR chart when showAmr is enabled", async () => {
    const amrData = {
      antibiotics: [
        {
          antibiotic: "ciprofloxacin",
          Resistant: 1,
          Susceptible: 2,
          Intermediate: 0,
          total: 3,
        },
      ],
    };
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    vi.mocked(fetchAmrPhenotypeDistribution).mockResolvedValueOnce(amrData);
    amrSpy.mockClear();

    await renderServer(
      MetadataDistributions({ taxonId: 197, fields: [], showAmr: true }),
    );

    expect(fetchAmrPhenotypeDistribution).toHaveBeenCalledWith(197);
    expect(screen.getByTestId("amr-chart")).toBeInTheDocument();
    expect(amrSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Antimicrobial Resistance Profile",
        data: amrData,
      }),
    );
  });

  it("falls back to empty AMR data when the AMR fetch fails and surfaces the error", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    vi.mocked(fetchAmrPhenotypeDistribution).mockRejectedValueOnce(
      new Error("amr boom"),
    );
    amrSpy.mockClear();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderServer(
      MetadataDistributions({ taxonId: 197, fields: [], showAmr: true }),
    );

    expect(screen.getByTestId("amr-chart")).toBeInTheDocument();
    expect(amrSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { antibiotics: [] },
        errorMessage: "amr boom",
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("amr boom"),
    );
    warnSpy.mockRestore();
  });

  it("summarizes a Genome query and leaves out an empty AMR chart", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    vi.mocked(fetchAmrPhenotypeDistribution).mockResolvedValueOnce({
      antibiotics: [],
    });

    await renderServer(
      MetadataDistributions({
        genomeQuery: { keywordRql: "keyword(pseudomonas)" },
        fields: ["genus"],
        showAmr: true,
        hideEmptyAmr: true,
      }),
    );

    const scope = { keywordRql: "keyword(pseudomonas)" };
    expect(fetchOrganismMetadataFacets).toHaveBeenLastCalledWith(scope, [
      "genus",
    ]);
    expect(fetchTaxonomicDistribution).toHaveBeenLastCalledWith(scope);
    expect(fetchAmrPhenotypeDistribution).toHaveBeenLastCalledWith(scope);
    expect(screen.queryByTestId("amr-chart")).not.toBeInTheDocument();
  });

  it("still shows a failed AMR request when empty AMR charts are hidden", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({});
    vi.mocked(fetchAmrPhenotypeDistribution).mockRejectedValueOnce(
      new Error("amr boom"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderServer(
      MetadataDistributions({
        genomeQuery: { keywordRql: "keyword(pseudomonas)" },
        fields: [],
        showAmr: true,
        hideEmptyAmr: true,
      }),
    );

    expect(screen.getByTestId("amr-chart")).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("genome query keyword(pseudomonas): amr boom"),
    );
    warnSpy.mockRestore();
  });

  it("links each bucket to its genomes in the given Genomes tab", async () => {
    push.mockClear();
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      host_common_name: [
        { name: "Human", count: 30 },
        { name: "", count: 5 },
      ],
      collection_year: [
        { name: "2014", count: 7 },
        { name: "2015", count: 0 },
      ],
    });
    vi.mocked(fetchTaxonomicDistribution).mockResolvedValueOnce({
      genus: [{ name: "Brucella", count: 100 }],
      species: [],
    });

    await renderServer(
      MetadataDistributions({
        taxonId: 11266,
        fields: ["host_common_name", "collection_year"],
        genomeList: { pathname: "/taxonomy/11266", params: { tab: "genomes" } },
      }),
    );

    for (const [name, href] of [
      ["Human: 30", "/taxonomy/11266?tab=genomes&host_common_name=Human"],
      ["2014: 7", "/taxonomy/11266?tab=genomes&collection_year=2014"],
      ["Brucella: 100", "/taxonomy/11266?tab=genomes&genus=Brucella"],
    ]) {
      fireEvent.keyDown(screen.getByRole("link", { name }), { key: "Enter" });
      expect(push).toHaveBeenLastCalledWith(href);
    }
    // Neither a blank bucket nor an empty year has genomes to list.
    expect(screen.queryByRole("link", { name: "Unspecified: 5" })).toBeNull();
    expect(screen.queryByRole("link", { name: "2015: 0" })).toBeNull();
  });

  it("links nothing without a Genomes tab", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockResolvedValueOnce({
      host_common_name: [{ name: "Human", count: 30 }],
    });

    await renderServer(
      MetadataDistributions({ taxonId: 11266, fields: ["host_common_name"] }),
    );

    expect(screen.queryByRole("link")).toBeNull();
  });
});
