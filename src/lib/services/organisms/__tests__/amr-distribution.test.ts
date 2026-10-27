import { http, HttpResponse } from "msw";

import { fetchAmrPhenotypeDistribution } from "@/lib/services/organisms/amr-distribution";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function pivotResponse(pivotRows: unknown[]) {
  return {
    response: { numFound: 0 },
    facet_counts: {
      facet_pivot: {
        "antibiotic,resistant_phenotype": pivotRows,
      },
    },
  };
}

describe("fetchAmrPhenotypeDistribution", () => {
  it("POSTs to /genome_amr/ with the expected RQL body and headers", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    let capturedAccept = "";
    let capturedContentType = "";

    server.use(
      http.post(`${baseUrl}/genome_amr/`, async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.text();
        capturedAccept = request.headers.get("Accept") ?? "";
        capturedContentType = request.headers.get("Content-Type") ?? "";
        return HttpResponse.json(pivotResponse([]));
      }),
    );

    await fetchAmrPhenotypeDistribution(197);

    expect(capturedUrl).toBe(`${baseUrl}/genome_amr/`);
    expect(capturedBody).toContain("eq(genome_id,*)");
    expect(capturedBody).toContain(
      "genome(and(eq(taxon_lineage_ids,197),ne(genome_status,Deprecated)))",
    );
    expect(capturedBody).toContain(
      "in(resistant_phenotype,(Resistant,Susceptible,Intermediate))",
    );
    expect(capturedBody).toContain("pivot,(antibiotic,resistant_phenotype)");
    expect(capturedAccept).toBe("application/solr+json");
    expect(capturedContentType).toBe(
      "application/rqlquery+x-www-form-urlencoded",
    );
  });

  it.each([
    [
      "joins genome fields and runs keywords on the AMR records",
      { fieldRql: "eq(genome_status,Complete)", keywordRql: "keyword(pseudomonas)" },
      "eq(genome_id,*)&genome(eq(genome_status,Complete))&keyword(pseudomonas)&in(",
    ],
    [
      "runs a keyword-only query on the AMR records, as legacy does",
      { keywordRql: "keyword(pseudomonas)" },
      "eq(genome_id,*)&keyword(pseudomonas)&in(",
    ],
  ])("%s", async (_label, scope, prefix) => {
    let capturedBody = "";
    server.use(
      http.post(`${baseUrl}/genome_amr/`, async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json(pivotResponse([]));
      }),
    );

    await fetchAmrPhenotypeDistribution(scope);

    // The website API rejects a keyword inside genome() on genome_amr.
    expect(capturedBody.startsWith(prefix)).toBe(true);
  });

  it("returns empty antibiotics when pivot is empty", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, () =>
        HttpResponse.json(pivotResponse([])),
      ),
    );

    await expect(fetchAmrPhenotypeDistribution(197)).resolves.toEqual({
      antibiotics: [],
    });
  });

  it("zero-fills missing phenotype keys and computes total", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, () =>
        HttpResponse.json(
          pivotResponse([
            {
              value: "florfenicol",
              pivot: [{ value: "Susceptible", count: 569 }],
            },
          ]),
        ),
      ),
    );

    const result = await fetchAmrPhenotypeDistribution(197);

    expect(result.antibiotics).toEqual([
      {
        antibiotic: "florfenicol",
        Resistant: 0,
        Susceptible: 569,
        Intermediate: 0,
        total: 569,
      },
    ]);
  });

  it("sorts antibiotics by total descending", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, () =>
        HttpResponse.json(
          pivotResponse([
            {
              value: "florfenicol",
              pivot: [{ value: "Susceptible", count: 569 }],
            },
            {
              value: "ciprofloxacin",
              pivot: [
                { value: "Resistant", count: 5815 },
                { value: "Susceptible", count: 12336 },
              ],
            },
            {
              value: "azithromycin",
              pivot: [
                { value: "Resistant", count: 55 },
                { value: "Susceptible", count: 588 },
              ],
            },
          ]),
        ),
      ),
    );

    const result = await fetchAmrPhenotypeDistribution(197);

    expect(result.antibiotics.map((a) => a.antibiotic)).toEqual([
      "ciprofloxacin", // 18151
      "azithromycin",  // 643
      "florfenicol",   // 569
    ]);
  });

  it("throws the upstream error message on non-ok response", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, () =>
        HttpResponse.text("upstream timeout", { status: 504 }),
      ),
    );

    await expect(fetchAmrPhenotypeDistribution(197)).rejects.toThrow(
      "Antimicrobial Resistance Profile: The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout: upstream timeout).",
    );
  });

  it("throws on missing facet_pivot", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, () =>
        HttpResponse.json({
          response: { numFound: 0 },
          facet_counts: { facet_fields: {} },
        }),
      ),
    );

    await expect(fetchAmrPhenotypeDistribution(197)).rejects.toThrow(
      /facet_pivot/,
    );
  });

  it("propagates AbortSignal cancellation", async () => {
    server.use(
      http.post(`${baseUrl}/genome_amr/`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(pivotResponse([]));
      }),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchAmrPhenotypeDistribution(197, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
