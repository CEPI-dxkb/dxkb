import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "@/app/api/e2e-mock/[...path]/route";
// `catchall.ts` only imports `JsonOverride` from `e2e/mocks/backends.ts` as a
// TYPE (`import type`), which esbuild/Vite elide entirely at compile time —
// no `@playwright/test` runtime import is pulled into this Vitest module.
// This lets us read the REAL browser-side override bundles, not just the
// shared records both layers happen to import.
import {
  epitopeScenarioOverrides,
  experimentScenarioOverrides,
  genomeScenarioOverrides,
  proteinStructureScenarioOverrides,
  serologyScenarioOverrides,
  surveillanceScenarioOverrides,
  taxonomyScenarioOverrides,
} from "../../../../e2e/fixtures/overrides/catchall";
import type { JsonOverride } from "../../../../e2e/mocks/backends";
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
 * mock (e2e/fixtures/overrides/catchall.ts) and the server-side loopback mock
 * (src/app/api/e2e-mock/[...path]/route.ts, via the real GET handler) must
 * serve the SAME record content for a given resource, even though their
 * envelopes differ by transport.
 *
 * Before the shared `records.ts` module existed, epitope `host_name` was an
 * array in the browser layer and a bare string in the server layer — the two
 * layers rendered the same page differently depending on which fetch (SSR vs.
 * client refetch) supplied the data. Each test below calls the real `route.ts`
 * GET handler AND reads the real, statically-defined `JsonOverride.body` from
 * the matching `catchall.ts` bundle for the same resource, then diffs the two
 * — so a future edit that re-inlines a diverging literal in *either* file
 * (not just a change to `records.ts`) fails loudly here instead of drifting
 * silently again.
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

/**
 * Finds the browser-side gateway override (`/api/data/<resource>` — never the
 * `/api/e2e-mock/data/<resource>` loopback-direct variant some bundles also
 * carry) for a given method, and returns its statically-defined body's rows.
 * `sampleUrl` must NOT contain "e2e-mock" so it doesn't accidentally match a
 * bundle's loopback-direct entry instead of its gateway entry.
 */
function gatewayRowsFromBundle(
  bundle: JsonOverride[],
  method: string,
  sampleUrl: string,
): unknown[] {
  if (sampleUrl.includes("e2e-mock")) {
    throw new Error(
      "sampleUrl must target the same-origin gateway, not the e2e-mock loopback",
    );
  }
  const override = bundle.find((candidate) => {
    if (candidate.method !== method) return false;
    return typeof candidate.url === "string"
      ? sampleUrl.includes(candidate.url)
      : candidate.url.test(sampleUrl);
  });
  if (!override) {
    throw new Error(`No ${method} override in bundle matched ${sampleUrl}`);
  }
  const { body } = override;
  if (!body || typeof body !== "object" || !("rows" in body)) {
    throw new Error(
      `Expected a static object body with "rows" for ${method} ${sampleUrl}`,
    );
  }
  return (body as { rows: unknown[] }).rows;
}

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
    const browserRows = gatewayRowsFromBundle(
      epitopeScenarioOverrides,
      "GET",
      "http://localhost/api/data/epitope?eq(epitope_id,15780)",
    );

    expect(browserRows).toEqual([epitopeRecord]);
    expect(serverBody.response.docs).toEqual([epitopeRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    const browserRows = gatewayRowsFromBundle(
      genomeScenarioOverrides,
      "GET",
      "http://localhost/api/data/genome?keyword(MERS*)",
    );

    expect(browserRows).toEqual([genomeRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    const browserRows = gatewayRowsFromBundle(
      taxonomyScenarioOverrides,
      "GET",
      "http://localhost/api/data/taxonomy?eq(taxon_id,11520)",
    );

    expect(browserRows).toEqual([taxonomyRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    const browserRows = gatewayRowsFromBundle(
      experimentScenarioOverrides,
      "GET",
      "http://localhost/api/data/experiment?eq(exp_id,2000000)",
    );

    expect(browserRows).toEqual([experimentRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    // The browser-side gateway override always returns just the primary
    // record (never the ambiguous ones) regardless of query — see
    // e2e/fixtures/overrides/catchall.ts's surveillanceScenarioOverrides.
    const browserRows = gatewayRowsFromBundle(
      surveillanceScenarioOverrides,
      "GET",
      "http://localhost/api/data/surveillance?eq(sample_identifier,sample/1)",
    );

    expect(browserRows).toEqual([surveillanceRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    const browserRows = gatewayRowsFromBundle(
      serologyScenarioOverrides,
      "GET",
      "http://localhost/api/data/serology?eq(sample_identifier,000123)",
    );

    expect(browserRows).toEqual([serologyRecord]);
    expect(serverBody.response.docs).toEqual(browserRows);
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
    const browserRows = gatewayRowsFromBundle(
      proteinStructureScenarioOverrides,
      "GET",
      "http://localhost/api/data/protein_structure?eq(pdb_id,*)",
    );

    expect(browserRows).toEqual(proteinStructureRecords);
    expect(serverBody.response.docs).toEqual(browserRows);
  });
});
