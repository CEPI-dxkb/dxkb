import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Suspense } from "react";
import { vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

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

type Facets = Awaited<ReturnType<typeof fetchOrganismMetadataFacets>>;

/** Answers each per-field facet request from `facets`. */
function mockFacets(facets: Facets) {
  vi.mocked(fetchOrganismMetadataFacets).mockImplementation(
    (_scope, fields) =>
      Promise.resolve(
        Object.fromEntries(fields.map((field) => [field, facets[field] ?? []])),
      ),
  );
}

beforeEach(() => {
  refresh.mockClear();
  vi.mocked(fetchOrganismMetadataFacets).mockReset();
  vi.mocked(fetchTaxonomicDistribution).mockResolvedValue(emptyTaxonomic);
});

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("MetadataDistributions", () => {
  it("renders configured donut charts", async () => {
    mockFacets({
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
    mockFacets({});
    vi.mocked(fetchTaxonomicDistribution).mockResolvedValueOnce({
      genus: [{ name: "Brucella", count: 100 }],
      species: [{ name: "Brucella abortus", count: 50 }],
    });

    await renderServer(MetadataDistributions({ taxonId: 234, fields: [] }));

    expect(fetchTaxonomicDistribution).toHaveBeenCalledWith(234);
    expect(screen.getByText("Taxonomic Distribution")).toBeInTheDocument();
  });

  it("still renders when the taxonomic distribution fetch fails and shows an inline error", async () => {
    mockFacets({
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
    mockFacets({
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
    mockFacets({
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
    mockFacets({});
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
    mockFacets({});
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
    mockFacets({});
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
    mockFacets({});
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
    mockFacets({});
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
    mockFacets({
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
    mockFacets({
      host_common_name: [{ name: "Human", count: 30 }],
    });

    await renderServer(
      MetadataDistributions({ taxonId: 11266, fields: ["host_common_name"] }),
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("fails only the chart whose facet failed, keeping the rest of the grid", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockImplementation((_scope, fields) =>
      fields[0] === "host_common_name"
        ? Promise.reject(
            new Error(
              "Host Distribution: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).",
            ),
          )
        : Promise.resolve({ genus: [{ name: "Escherichia", count: 20 }] }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderServer(
      MetadataDistributions({
        taxonId: 562,
        fields: ["genus", "host_common_name"],
      }),
    );

    expect(fetchOrganismMetadataFacets).toHaveBeenCalledWith(562, ["genus"]);
    expect(fetchOrganismMetadataFacets).toHaveBeenCalledWith(562, [
      "host_common_name",
    ]);
    expect(screen.getByTestId("metadata-distributions")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Genus distribution" })).toBeInTheDocument();
    expect(screen.getByText("Host Distribution")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not load: Host Distribution: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).",
    );
    // The section rendered, so its own Retry never appears: the chart's
    // refreshes the route, re-running the failed facet.
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    // The field name stays in the server log, for an operator.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("genome host_common_name facet fetch failed"),
    );
    warnSpy.mockRestore();
  });

  it("fails the collection-year chart on its own too", async () => {
    vi.mocked(fetchOrganismMetadataFacets).mockImplementation((_scope, fields) =>
      fields[0] === "collection_year"
        ? Promise.reject(
            new Error(
              "Collection Year: The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout).",
            ),
          )
        : Promise.resolve({ genus: [{ name: "Escherichia", count: 20 }] }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderServer(
      MetadataDistributions({ taxonId: 562, fields: ["genus", "collection_year"] }),
    );

    expect(screen.getByRole("img", { name: "Genus distribution" })).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not load: Collection Year: The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout).",
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    warnSpy.mockRestore();
  });

  it("rethrows once, for the section error, when every request failed", async () => {
    const outage = new Error("Genus: Could not reach the BV-BRC data service.");
    vi.mocked(fetchOrganismMetadataFacets).mockRejectedValue(outage);
    vi.mocked(fetchTaxonomicDistribution).mockRejectedValueOnce(
      new Error("Taxonomic Distribution: Could not reach the BV-BRC data service."),
    );

    await expect(
      MetadataDistributions({ taxonId: 562, fields: ["genus", "host_name"] }),
    ).rejects.toBe(outage);
  });
});
