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

/** Answers the experimental structure count the PDB tile uses, one number per lineage id. */
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

function summaryBody(count: number) {
  return {
    count,
    unique_family: 391,
    unique_genus: 5432,
    unique_species: 82915,
    CDS: 482001224,
    mat_peptide: 23144,
    PDB: 9821,
  };
}

/** Answers the genome count the Taxonomy header uses, one number per lineage id, and records each request. */
function serveGenomeCounts(counts: Record<string, number>) {
  const requests: { url: string; authorization: string | null }[] = [];
  server.use(
    http.get(`${baseUrl}/genome/`, ({ request }) => {
      requests.push({
        url: decodeURIComponent(request.url),
        authorization: request.headers.get("Authorization"),
      });
      const taxonId = /taxon_lineage_ids,(\d+)/.exec(
        decodeURIComponent(request.url),
      )?.[1];
      return HttpResponse.json({
        response: { numFound: counts[taxonId ?? ""] },
      });
    }),
  );
  return requests;
}

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("DataSummary", () => {
  it("renders all KPI cards with formatted values", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2] }));

    expect(screen.getByText("Families")).toBeInTheDocument();
    expect(screen.getByText("482,001,224")).toBeInTheDocument();
    // The experimental count, not the payload's PDB (9,821).
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("68,899");
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveAttribute(
      "title",
      "Experimentally determined structures (AlphaFold predictions excluded)",
    );
  });

  it("shows the Taxonomy header's genome count in the Genomes tile, not the summary's", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    const requests = serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2] }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "1,300,000",
    );
    expect(screen.queryByText("1,337,420")).not.toBeInTheDocument();
    // A landing page is public, so the count is requested without a token, and
    // leaves Deprecated genomes out.
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBeNull();
    expect(requests[0].url).toContain(
      "and(eq(taxon_lineage_ids,2),ne(genome_status,Deprecated))",
    );
  });

  it("sums the Genomes tile across several roots from their live counts", async () => {
    const requested: string[] = [];
    answerStructures({ 131567: 79_938, 10239: 17_243 });
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/131567`, () => {
        requested.push("131567");
        return HttpResponse.json({
          ...summaryBody(1_427_115),
          unique_family: 1076,
        });
      }),
      http.get(`${baseUrl}/data/summary_by_taxon/10239`, () => {
        requested.push("10239");
        return HttpResponse.json({
          ...summaryBody(16_388_875),
          unique_family: 352,
        });
      }),
    );
    const requests = serveGenomeCounts({ 131567: 1_400_000, 10239: 14_900_000 });

    await renderServer(DataSummary({ taxonIds: [131567, 10239] }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "16,300,000",
    );
    expect(screen.queryByText("17,815,990")).not.toBeInTheDocument();
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("97,181");
    expect(requested.toSorted()).toEqual(["10239", "131567"]);
    expect(requests).toHaveLength(2);
  });

  it("rejects when the genome count fails, like a failed summary", async () => {
    answerStructures({ 2: 68_899 });
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ error: "count down" }, { status: 500 }),
      ),
    );

    await expect(DataSummary({ taxonIds: [2] })).rejects.toThrow(/count down/);
  });

  it("rejects when the summary fails", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({ error: "summary down" }, { status: 500 }),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await expect(DataSummary({ taxonIds: [2] })).rejects.toThrow();
  });
});
