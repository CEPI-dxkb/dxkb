import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Suspense } from "react";
import { vi } from "vitest";

// The charts navigate on a slice click and the section error's Retry refreshes
// the route; neither runs here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Render the charts synchronously; the lazy wrappers are covered by lazy-charts.test.tsx.
vi.mock("@/components/organisms/metadata-distributions/lazy-charts", async () => {
  const [bar, donut] = await Promise.all([
    import("@/components/organisms/metadata-distributions/bar-chart"),
    import("@/components/organisms/metadata-distributions/donut-chart"),
  ]);
  return { LazyBarChart: bar.BarChart, LazyDonutChart: donut.DonutChart };
});

import { server } from "@/test-helpers/msw-server";

import {
  DataSummaryBoundary,
  MetadataDistributionsBoundary,
} from "../overview";

const baseUrl = "https://bvbrc.test/api-for-website";

// Live summary_by_taxon payloads (2026-11-13). Viruses alone outnumbers the
// cellular organisms, which is how All once showed fewer genomes than Viruses.
const cellularSummary = {
  count: 1_427_115,
  unique_family: 1076,
  unique_genus: 5057,
  unique_species: 92_527,
  CDS: 7_568_005_765,
  mat_peptide: 2197,
  PDB: 32_110_369,
};
const virusesSummary = {
  count: 16_388_875,
  unique_family: 352,
  unique_genus: 3327,
  unique_species: 65_960,
  CDS: 268_763_979,
  mat_peptide: 220_813_528,
  PDB: 47_106,
};

// Experimental structures per root (live, 2026-11-13): summary_by_taxon's PDB
// above counts the AlphaFold models too, so the tile takes these instead.
const experimentalStructureCounts: Record<number, number> = {
  131567: 79_938,
  10239: 17_243,
};

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.restoreAllMocks();
});

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

function serveStructureCounts() {
  server.use(
    http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
      const search = decodeURIComponent(new URL(request.url).search);
      const taxonId = Number(/eq\(taxon_lineage_ids,(\d+)\)/.exec(search)?.[1]);
      return HttpResponse.json({
        response: {
          numFound: experimentalStructureCounts[taxonId] ?? 0,
          docs: [],
        },
      });
    }),
  );
}

function serveSummaries() {
  serveStructureCounts();
  server.use(
    http.get(`${baseUrl}/data/summary_by_taxon/131567`, () =>
      HttpResponse.json(cellularSummary),
    ),
    http.get(`${baseUrl}/data/summary_by_taxon/10239`, () =>
      HttpResponse.json(virusesSummary),
    ),
  );
}

describe("All Organisms Overview", () => {
  describe("Data summary", () => {
    it("shows the cellular organisms plus the viruses, never fewer than Viruses alone", async () => {
      serveSummaries();

      await renderServer(DataSummaryBoundary());

      const genomes = screen.getByTestId("organism-kpi-count");
      expect(genomes).toHaveTextContent("17,815,990");
      expect(genomes).not.toHaveTextContent("1,427,115");
      // The tile's text is its "Genomes" label plus the formatted count.
      const shown = Number(genomes.textContent.replaceAll(/\D/g, ""));
      expect(shown).toBeGreaterThanOrEqual(virusesSummary.count);
    });

    it("sums the experimental structures of both roots, not summary_by_taxon's PDB", async () => {
      serveSummaries();

      await renderServer(DataSummaryBoundary());

      const structures = screen.getByTestId("organism-kpi-pdb");
      expect(structures).toHaveTextContent("97,181");
      expect(structures).not.toHaveTextContent("32,157,475");
    });

    it("fails the whole section, with the original message and no partial total, when one root is down", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      serveStructureCounts();
      server.use(
        http.get(`${baseUrl}/data/summary_by_taxon/131567`, () =>
          HttpResponse.json(cellularSummary),
        ),
        http.get(`${baseUrl}/data/summary_by_taxon/10239`, () =>
          HttpResponse.text("BV-BRC overloaded", { status: 503 }),
        ),
      );

      await renderServer(DataSummaryBoundary());

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Data summary could not be loaded",
      );
      expect(screen.getByTestId("section-error-message")).toHaveTextContent(
        "BV-BRC overloaded",
      );
      expect(screen.queryByTestId("organism-kpi-count")).not.toBeInTheDocument();
      expect(screen.queryByText("1,427,115")).not.toBeInTheDocument();
    });
  });

  describe("Metadata distributions", () => {
    it("counts the genomes of both roots, less Deprecated, in Host Group, Isolation Country and the taxonomic donut", async () => {
      const requested: string[] = [];
      server.use(
        http.get(`${baseUrl}/genome/`, ({ request }) => {
          const search = decodeURIComponent(new URL(request.url).search);
          requested.push(search);
          const field = /\(field,([a-z_]+)\)/.exec(search)?.[1] ?? "";
          const values: Record<string, (string | number)[]> = {
            host_group: ["Human", 120, "Bird", 30],
            isolation_country: ["USA", 90, "China", 40],
            genus: ["Escherichia", 70, "Influenzavirus", 60],
            species: ["Escherichia coli", 65, "Influenza A virus", 55],
          };
          return HttpResponse.json({
            response: { numFound: 150 },
            facet_counts: { facet_fields: { [field]: values[field] ?? [] } },
          });
        }),
      );

      await renderServer(MetadataDistributionsBoundary());

      // A chart whose slices link to the Genomes tab is a group, not an img.
      expect(
        screen.getByRole("group", { name: "Host Group distribution" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: "Isolation Country distribution" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: "Taxonomic Distribution distribution" }),
      ).toBeInTheDocument();

      // The All config has no taxonomic sentinel, so the genus and species
      // donut is added after the configured fields and takes the same scope:
      // one facet request per field, four in all.
      const metadataRequests = requested.filter((search) =>
        /\(field,(host_group|isolation_country|genus|species)\)/.test(search),
      );
      expect(metadataRequests).toHaveLength(4);
      for (const field of ["genus", "species"]) {
        expect(
          metadataRequests.filter((search) =>
            search.includes(`(field,${field})`),
          ),
        ).toHaveLength(1);
      }
      for (const search of metadataRequests) {
        expect(search).toContain(
          "or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239))",
        );
        expect(search).toContain("ne(genome_status,Deprecated)");
      }
    });
  });
});
