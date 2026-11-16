import { http, HttpResponse } from "msw";

import {
  fetchCombinedOrganismSummary,
  fetchOrganismSummary,
} from "@/lib/services/organisms/summary";
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

// Live payloads from `summary_by_taxon` (2026-11-13): cellular organisms and Viruses.
const cellularPayload = {
  strains_count: 0,
  PDB: 32_110_369,
  count: 1_427_115,
  unique_genus: 5057,
  unique_family: 1076,
  unique_species: 92_527,
  CDS: 7_568_005_765,
  mat_peptide: 2197,
};
const virusesPayload = {
  PDB: 47_106,
  strains_count: 311_356,
  count: 16_388_875,
  unique_genus: 3327,
  unique_family: 352,
  unique_species: 65_960,
  CDS: 268_763_979,
  mat_peptide: 220_813_528,
};

// The API leaves out a `unique_*` field when its value is 1, and `CDS` or
// `mat_peptide` when it is 0.
function omitFields(payload: Record<string, number>, fields: string[]) {
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => !fields.includes(field)),
  );
}

function answerSummaries(cellular: object, viruses: object) {
  server.use(
    http.get(`${baseUrl}/data/summary_by_taxon/131567`, () =>
      HttpResponse.json(cellular),
    ),
    http.get(`${baseUrl}/data/summary_by_taxon/10239`, () =>
      HttpResponse.json(viruses),
    ),
  );
}

describe("fetchCombinedOrganismSummary", () => {
  it("sums every field across the roots", async () => {
    answerSummaries(cellularPayload, virusesPayload);

    await expect(
      fetchCombinedOrganismSummary([131567, 10239]),
    ).resolves.toEqual({
      count: 17_815_990,
      uniqueFamily: 1428,
      uniqueGenus: 8384,
      uniqueSpecies: 158_487,
      cds: 7_836_769_744,
      matPeptide: 220_815_725,
      pdb: 32_157_475,
    });
  });

  it("counts at least as many genomes as the Viruses root alone", async () => {
    answerSummaries(cellularPayload, virusesPayload);

    const viruses = await fetchOrganismSummary(10239);
    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    expect(combined.count).toBeGreaterThanOrEqual(viruses.count ?? 0);
    expect(combined.count).toBe(
      (viruses.count ?? 0) + cellularPayload.count,
    );
  });

  it("is null only for a field both roots omit, and takes the other root's value when one omits it", async () => {
    answerSummaries(
      omitFields(cellularPayload, ["CDS", "mat_peptide"]),
      omitFields(virusesPayload, ["CDS", "unique_family"]),
    );

    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    // Missing in both roots.
    expect(combined.cds).toBeNull();
    // Missing in the cellular root only.
    expect(combined.matPeptide).toBe(virusesPayload.mat_peptide);
    // Missing in the Viruses root only.
    expect(combined.uniqueFamily).toBe(cellularPayload.unique_family);
  });

  it("returns exactly what fetchOrganismSummary returns for a single id", async () => {
    answerSummaries(cellularPayload, virusesPayload);

    await expect(fetchCombinedOrganismSummary([10239])).resolves.toEqual(
      await fetchOrganismSummary(10239),
    );
  });

  it("rejects with the failing root's original message when one root is down", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/131567`, () =>
        HttpResponse.json(cellularPayload),
      ),
      http.get(`${baseUrl}/data/summary_by_taxon/10239`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );

    await expect(
      fetchCombinedOrganismSummary([131567, 10239]),
    ).rejects.toMatchObject({
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      source: "summary_by_taxon",
    });
  });

  it("throws on an empty id list", async () => {
    await expect(fetchCombinedOrganismSummary([])).rejects.toThrow(
      "Combined organism summaries need at least one taxon id.",
    );
  });
});
