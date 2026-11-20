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

// `protein_structure` answers the experimental count the summary's `pdb` takes.
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
    answerStructures({ 2: 70 });

    const summary = await fetchOrganismSummary(2);

    expect({ ...summary, pdb: await summary.pdb }).toEqual({
      count: 10,
      uniqueFamily: 2,
      uniqueGenus: 3,
      uniqueSpecies: 4,
      cds: 50,
      matPeptide: 6,
      pdb: { status: "fulfilled", value: 70 },
    });
  });

  it("resolves with the summary without waiting for the structure join", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/9000103`, () =>
        HttpResponse.json({ count: 3, unique_species: 4, CDS: 50 }),
      ),
    );
    const gate = Promise.withResolvers<undefined>();
    server.use(
      http.get(`${baseUrl}/protein_structure/`, async () => {
        await gate.promise;
        return HttpResponse.json({ response: { numFound: 12, docs: [] } });
      }),
    );

    const summary = await fetchOrganismSummary(9000103);

    // The call returned while the join is still running.
    expect(summary).toMatchObject({ count: 3, uniqueSpecies: 4, cds: 50 });
    gate.resolve(undefined);
    await expect(summary.pdb).resolves.toEqual({
      status: "fulfilled",
      value: 12,
    });
  });

  it("counts experimental structures, not summary_by_taxon's PDB", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({ count: 1, PDB: 31_134_082 }),
      ),
    );
    answerStructures({ 2: 68_899 });

    const summary = await fetchOrganismSummary(2);

    await expect(summary.pdb).resolves.toEqual({
      status: "fulfilled",
      value: 68_899,
    });
  });

  it("reads pdb through the shared cache, so a second summary does not recount", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/9000101`, () =>
        HttpResponse.json({ count: 1, PDB: 5 }),
      ),
    );
    let structureRequests = 0;
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () => {
        structureRequests += 1;
        return HttpResponse.json({ response: { numFound: 257, docs: [] } });
      }),
    );

    const first = await fetchOrganismSummary(9000101);
    await expect(first.pdb).resolves.toEqual({
      status: "fulfilled",
      value: 257,
    });
    const second = await fetchOrganismSummary(9000101);
    await expect(second.pdb).resolves.toEqual({
      status: "fulfilled",
      value: 257,
    });

    expect(structureRequests).toBe(1);
  });

  it("keeps the other counts and carries the structure count's own failure in pdb", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({
          count: 1,
          unique_species: 4,
          CDS: 50,
          mat_peptide: 6,
          PDB: 5,
        }),
      ),
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );

    const summary = await fetchOrganismSummary(2);

    expect(summary).toMatchObject({
      uniqueSpecies: 4,
      cds: 50,
      matPeptide: 6,
    });
    // The failure rides in `pdb`, which resolves (never rejects).
    await expect(summary.pdb).resolves.toEqual({
      status: "rejected",
      reason: expect.objectContaining({
        message:
          "PDB structures: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
        source: "protein_structure count",
      }) as unknown,
    });
  });

  it("throws the original upstream response text on non-2xx", async () => {
    answerStructures({ 2: 1 });
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
    answerStructures({ 2: 1 });
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
    answerStructures({ 2: 1 });
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

// Experimental structures under cellular organisms and Viruses (live, 2026-11-13).
const rootStructureCounts = { 131567: 79_938, 10239: 17_243 };

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
    answerStructures(rootStructureCounts);

    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    expect({ ...combined, pdb: await combined.pdb }).toEqual({
      count: 17_815_990,
      uniqueFamily: 1428,
      uniqueGenus: 8384,
      uniqueSpecies: 158_487,
      cds: 7_836_769_744,
      matPeptide: 220_815_725,
      pdb: { status: "fulfilled", value: 97_181 },
    });
  });

  it("counts at least as many genomes as the Viruses root alone", async () => {
    answerSummaries(cellularPayload, virusesPayload);
    answerStructures(rootStructureCounts);

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
    answerStructures(rootStructureCounts);

    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    // Missing in both roots.
    expect(combined.cds).toBeNull();
    // Missing in the cellular root only.
    expect(combined.matPeptide).toBe(virusesPayload.mat_peptide);
    // Missing in the Viruses root only.
    expect(combined.uniqueFamily).toBe(cellularPayload.unique_family);
  });

  it("is null for count when one root lacks it, while another field present in only one root still sums", async () => {
    answerSummaries(
      omitFields(cellularPayload, ["count", "unique_family"]),
      virusesPayload,
    );
    answerStructures(rootStructureCounts);

    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    // The other root's count alone would pass for the All count, which is the
    // bug this change fixes.
    expect(combined.count).toBeNull();
    // Missing in the cellular root only: the Viruses value still stands.
    expect(combined.uniqueFamily).toBe(virusesPayload.unique_family);
    expect(combined.uniqueGenus).toBe(
      cellularPayload.unique_genus + virusesPayload.unique_genus,
    );
  });

  it("returns exactly what fetchOrganismSummary returns for a single id", async () => {
    answerSummaries(cellularPayload, virusesPayload);
    answerStructures(rootStructureCounts);

    await expect(fetchCombinedOrganismSummary([10239])).resolves.toEqual(
      await fetchOrganismSummary(10239),
    );
  });

  it("rejects with the failing root's original message when one root is down", async () => {
    answerStructures(rootStructureCounts);
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

  it("reports a root's failed structure count in pdb, not the other root's count, while the other fields still sum", async () => {
    answerSummaries(cellularPayload, virusesPayload);
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        const search = decodeURIComponent(new URL(request.url).search);
        return search.includes("eq(taxon_lineage_ids,10239)")
          ? HttpResponse.text("BV-BRC overloaded", { status: 503 })
          : HttpResponse.json({ response: { numFound: 100, docs: [] } });
      }),
    );

    const combined = await fetchCombinedOrganismSummary([131567, 10239]);

    await expect(combined.pdb).resolves.toEqual({
      status: "rejected",
      reason: expect.objectContaining({
        message:
          "PDB structures: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      }) as unknown,
    });
    expect(combined.count).toBe(17_815_990);
    expect(combined.cds).toBe(7_836_769_744);
  });

  it("does not swallow abort errors", async () => {
    answerStructures(rootStructureCounts);
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchCombinedOrganismSummary([131567, 10239], {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("throws on an empty id list", async () => {
    await expect(fetchCombinedOrganismSummary([])).rejects.toThrow(
      "Combined organism summaries need at least one taxon id.",
    );
  });
});
