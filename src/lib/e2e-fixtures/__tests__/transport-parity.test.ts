import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "@/app/api/e2e-mock/[...path]/route";
import { buildGatewayCollectionEnvelope } from "../envelopes";
import {
  epitopeRecord,
  experimentRecord,
  genomeRecord,
  proteinStructureRecords,
  serologyRecord,
  surveillanceRecord,
  taxonomyRecord,
} from "../records";

/**
 * Regression guard for the exact defect this module fixes: the browser-side
 * mock (e2e/fixtures/overrides/catchall.ts, via `buildGatewayCollectionEnvelope`)
 * and the server-side loopback mock (src/app/api/e2e-mock/[...path]/route.ts,
 * via the real GET handler) must serve the SAME record content for a given
 * resource, even though their envelopes differ by transport.
 *
 * Before the shared `records.ts` module existed, epitope `host_name` was an
 * array in the browser layer and a bare string in the server layer — the two
 * layers rendered the same page differently depending on which fetch (SSR vs.
 * client refetch) supplied the data. These tests parse the server layer's
 * real response and diff it against the browser layer's envelope-wrapped
 * canonical record, so a future edit that re-inlines a diverging literal in
 * either file fails loudly here instead of drifting silently again.
 */

function routeContext(path: string[]): { params: Promise<{ path: string[] }> } {
  return { params: Promise.resolve({ path }) };
}

const originalMockEnabled = process.env.E2E_MOCK_ENABLED;

beforeEach(() => {
  process.env.E2E_MOCK_ENABLED = "1";
});

afterEach(() => {
  if (originalMockEnabled === undefined) {
    delete process.env.E2E_MOCK_ENABLED;
  } else {
    process.env.E2E_MOCK_ENABLED = originalMockEnabled;
  }
});

describe("browser vs. server transport parity for shared canonical records", () => {
  it("epitope 15780 — host_name is array-valued in both transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/epitope/?eq(epitope_id,15780)",
      }),
      routeContext(["data", "epitope"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([epitopeRecord]);

    expect(serverBody.response.docs).toEqual([epitopeRecord]);
    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("genome 1282460.2049 — identical record across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/genome/?keyword(MERS*)&sort(+genome_name,+genome_id)",
      }),
      routeContext(["data", "genome"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([genomeRecord]);

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("taxonomy 11520 — identical record across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/taxonomy/?eq(taxon_id,11520)",
      }),
      routeContext(["data", "taxonomy"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([taxonomyRecord]);

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("experiment 2000000 — identical record across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/experiment/?eq(exp_id,2000000)",
      }),
      routeContext(["data", "experiment"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([experimentRecord]);

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("surveillance sample/1 — identical record across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/surveillance/?eq(sample_identifier,sample/1)",
      }),
      routeContext(["data", "surveillance"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([
      surveillanceRecord,
    ]);

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("serology 000123 — identical record across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/serology/?eq(sample_identifier,000123)",
      }),
      routeContext(["data", "serology"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope([serologyRecord]);

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });

  it("protein_structure 6VXX/7BV2 — identical records across transports", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/protein_structure/?eq(pdb_id,*)",
      }),
      routeContext(["data", "protein_structure"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserEnvelope = buildGatewayCollectionEnvelope(
      proteinStructureRecords,
    );

    expect(serverBody.response.docs).toEqual(browserEnvelope.rows);
  });
});
