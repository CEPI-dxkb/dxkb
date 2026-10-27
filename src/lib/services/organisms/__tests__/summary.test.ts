import { http, HttpResponse } from "msw";

import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("fetchOrganismSummary", () => {
  it("maps BV-BRC summary fields to camelCase", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({
          count: 10,
          unique_family: 2,
          unique_genus: 3,
          unique_species: 4,
          CDS: 50,
          mat_peptide: 6,
          PDB: 7,
        }),
      ),
    );

    await expect(fetchOrganismSummary(2)).resolves.toEqual({
      count: 10,
      uniqueFamily: 2,
      uniqueGenus: 3,
      uniqueSpecies: 4,
      cds: 50,
      matPeptide: 6,
      pdb: 7,
    });
  });

  it("throws the original upstream response text on non-2xx", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );

    await expect(fetchOrganismSummary(2)).rejects.toMatchObject({
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      source: "summary_by_taxon",
    });
  });

  it("throws on malformed numeric fields", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({
          count: "not numeric",
          unique_family: 2,
          unique_genus: 3,
          unique_species: 4,
          CDS: 50,
          mat_peptide: 6,
          PDB: 7,
        }),
      ),
    );

    await expect(fetchOrganismSummary(2)).rejects.toThrow("count is not numeric");
  });

  it("does not swallow abort errors", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(fetchOrganismSummary(2, { signal: controller.signal })).rejects.toThrow();
  });
});
