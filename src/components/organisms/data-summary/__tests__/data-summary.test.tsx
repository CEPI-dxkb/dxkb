import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Suspense } from "react";

import { DataSummary } from "../data-summary";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function answerStructures(counts: Record<number, number>) {
  server.use(
    http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
      const search = decodeURIComponent(new URL(request.url).search);
      const taxonId = Number(/eq\(taxon_lineage_ids,(\d+)\)/.exec(search)?.[1]);
      return HttpResponse.json({
        response: { numFound: counts[taxonId] ?? 0, docs: [] },
      });
    }),
  );
}

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("DataSummary", () => {
  it("renders all KPI cards with formatted values", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({
          count: 1337420,
          unique_family: 391,
          unique_genus: 5432,
          unique_species: 82915,
          CDS: 482001224,
          mat_peptide: 23144,
          PDB: 9821,
        }),
      ),
    );
    answerStructures({ 2: 68_899 });

    await renderServer(DataSummary({ taxonIds: [2] }));

    expect(screen.getByText("1,337,420")).toBeInTheDocument();
    expect(screen.getByText("Families")).toBeInTheDocument();
    expect(screen.getByText("482,001,224")).toBeInTheDocument();
    // The experimental count, not the payload's PDB (9,821).
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("68,899");
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveAttribute(
      "title",
      "Experimentally determined structures (AlphaFold predictions excluded)",
    );
  });

  it("sums the Genomes tile across several roots", async () => {
    const requested: string[] = [];
    answerStructures({ 131567: 79_938, 10239: 17_243 });
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/131567`, () => {
        requested.push("131567");
        return HttpResponse.json({
          count: 1_427_115,
          unique_family: 1076,
          unique_genus: 5057,
          unique_species: 92_527,
          CDS: 7_568_005_765,
          mat_peptide: 2197,
          PDB: 32_110_369,
        });
      }),
      http.get(`${baseUrl}/data/summary_by_taxon/10239`, () => {
        requested.push("10239");
        return HttpResponse.json({
          count: 16_388_875,
          unique_family: 352,
          unique_genus: 3327,
          unique_species: 65_960,
          CDS: 268_763_979,
          mat_peptide: 220_813_528,
          PDB: 47_106,
        });
      }),
    );

    await renderServer(DataSummary({ taxonIds: [131567, 10239] }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "17,815,990",
    );
    expect(screen.queryByText("1,427,115")).not.toBeInTheDocument();
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("97,181");
    expect(requested.toSorted()).toEqual(["10239", "131567"]);
  });
});
