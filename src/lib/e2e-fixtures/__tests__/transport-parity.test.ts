import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "@/app/api/e2e-mock/[...path]/route";
// `catchall.ts` only imports `JsonOverride` from `e2e/mocks/backends.ts` as a
// TYPE (`import type`), which esbuild/Vite elide entirely at compile time —
// no `@playwright/test` runtime import is pulled into this Vitest module.
// (`e2e/mocks/backends.ts` DOES value-import `@playwright/test` itself, so
// this type-only import is load-bearing, not incidental.) This lets us read
// the REAL browser-side override bundles, not just the shared records both
// layers happen to import.
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
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
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
 * client refetch) supplied the data.
 *
 * **Exact coverage** (be precise here — an inaccurate broad claim is worse
 * than a narrow true one). For each of the 7 resources below, this test
 * diffs the server's real `route.ts` GET/loopback response against every
 * STATIC `JsonOverride` body in the matching `catchall.ts` bundle that also
 * carries row/doc data:
 *   - the gateway GET entry (`/api/data/<resource>`) — all 7 resources
 *   - the gateway POST entry (`/api/data/<resource>`) — all except `genome`,
 *     whose POST body is a dynamic function (`genomeDataResponse`, branching
 *     on `parsedBody.operation`) rather than a static literal, so there is
 *     nothing to statically diff there
 *   - the e2e-mock loopback GET entry (`/api/e2e-mock/data/<resource>/`) —
 *     only `experiment`, `surveillance`, and `serology` carry one with real
 *     data; `epitope`, `genome`, and `protein_structure` have no loopback
 *     entry in their bundle, and `taxonomy`'s loopback entry is deliberately
 *     empty by design (see its comment in catchall.ts) so there is nothing to
 *     diff there either
 *
 * A future edit that re-inlines a diverging literal into any of the covered
 * call sites — not just a change to `records.ts` — fails loudly here instead
 * of drifting silently again.
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

/**
 * Finds the browser-side e2e-mock loopback-direct override (`GET
 * /api/e2e-mock/data/<resource>/`) and returns its statically-defined body's
 * `response.docs`. `sampleUrl` MUST contain "e2e-mock" — the counterpart to
 * `gatewayRowsFromBundle`'s exclusion.
 */
function loopbackDocsFromBundle(
  bundle: JsonOverride[],
  sampleUrl: string,
): unknown[] {
  if (!sampleUrl.includes("e2e-mock")) {
    throw new Error(
      "sampleUrl must target the e2e-mock loopback, not the same-origin gateway",
    );
  }
  const override = bundle.find((candidate) => {
    if (candidate.method !== "GET") return false;
    return typeof candidate.url === "string"
      ? sampleUrl.includes(candidate.url)
      : candidate.url.test(sampleUrl);
  });
  if (!override) {
    throw new Error(`No GET override in bundle matched ${sampleUrl}`);
  }
  const { body } = override;
  if (
    !body ||
    typeof body !== "object" ||
    !("response" in body) ||
    typeof body.response !== "object" ||
    body.response === null ||
    !("docs" in body.response)
  ) {
    throw new Error(
      `Expected a static object body with "response.docs" for GET ${sampleUrl}`,
    );
  }
  return (body.response as { docs: unknown[] }).docs;
}

describe("browser vs. server transport parity for shared canonical records", () => {
  it("epitope 15780 — host_name is array-valued in both transports (GET + POST)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/epitope/?eq(epitope_id,15780)",
      }),
      routeContext(["data", "epitope"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserGetRows = gatewayRowsFromBundle(
      epitopeScenarioOverrides,
      "GET",
      "http://localhost/api/data/epitope?eq(epitope_id,15780)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      epitopeScenarioOverrides,
      "POST",
      "http://localhost/api/data/epitope",
    );

    expect(browserGetRows).toEqual([epitopeRecord]);
    expect(browserPostRows).toEqual([epitopeRecord]);
    expect(serverBody.response.docs).toEqual([epitopeRecord]);
  });

  it("genome 1282460.2049 — identical record across transports (GET only — POST body is a dynamic function, not a static literal)", async () => {
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

  it("taxonomy 11520 — identical record across transports (GET + POST — loopback entry is deliberately empty, not diffed)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/taxonomy/?eq(taxon_id,11520)",
      }),
      routeContext(["data", "taxonomy"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserGetRows = gatewayRowsFromBundle(
      taxonomyScenarioOverrides,
      "GET",
      "http://localhost/api/data/taxonomy?eq(taxon_id,11520)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      taxonomyScenarioOverrides,
      "POST",
      "http://localhost/api/data/taxonomy",
    );

    expect(browserGetRows).toEqual([taxonomyRecord]);
    expect(browserPostRows).toEqual([taxonomyRecord]);
    expect(serverBody.response.docs).toEqual([taxonomyRecord]);
  });

  it("experiment 2000000 — identical record across transports (GET + POST + loopback)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/experiment/?eq(exp_id,2000000)",
      }),
      routeContext(["data", "experiment"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserGetRows = gatewayRowsFromBundle(
      experimentScenarioOverrides,
      "GET",
      "http://localhost/api/data/experiment?eq(exp_id,2000000)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      experimentScenarioOverrides,
      "POST",
      "http://localhost/api/data/experiment",
    );
    const browserLoopbackDocs = loopbackDocsFromBundle(
      experimentScenarioOverrides,
      "http://localhost/api/e2e-mock/data/experiment/?eq(exp_id,2000000)",
    );

    expect(browserGetRows).toEqual([experimentRecord]);
    expect(browserPostRows).toEqual([experimentRecord]);
    expect(browserLoopbackDocs).toEqual([experimentRecord]);
    expect(serverBody.response.docs).toEqual([experimentRecord]);
  });

  it("surveillance sample/1 — identical record across transports (GET + POST + loopback)", async () => {
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
    // e2e/fixtures/overrides/catchall.ts's surveillanceScenarioOverrides —
    // but the loopback-direct entry returns all 3 rows unfiltered.
    const browserGetRows = gatewayRowsFromBundle(
      surveillanceScenarioOverrides,
      "GET",
      "http://localhost/api/data/surveillance?eq(sample_identifier,sample/1)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      surveillanceScenarioOverrides,
      "POST",
      "http://localhost/api/data/surveillance",
    );
    const browserLoopbackDocs = loopbackDocsFromBundle(
      surveillanceScenarioOverrides,
      "http://localhost/api/e2e-mock/data/surveillance/?eq(sample_identifier,sample/1)",
    );

    expect(browserGetRows).toEqual([surveillanceRecord]);
    expect(browserPostRows).toEqual([surveillanceRecord]);
    expect(browserLoopbackDocs).toEqual([
      surveillanceRecord,
      ...ambiguousSurveillanceRecords,
    ]);
    expect(serverBody.response.docs).toEqual([surveillanceRecord]);
  });

  it("serology 000123 — identical record across transports (GET + POST + loopback)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/serology/?eq(sample_identifier,000123)",
      }),
      routeContext(["data", "serology"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    // Same shape as surveillance above: the gateway entries return only the
    // primary record; the loopback-direct entry returns all 3 rows.
    const browserGetRows = gatewayRowsFromBundle(
      serologyScenarioOverrides,
      "GET",
      "http://localhost/api/data/serology?eq(sample_identifier,000123)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      serologyScenarioOverrides,
      "POST",
      "http://localhost/api/data/serology",
    );
    const browserLoopbackDocs = loopbackDocsFromBundle(
      serologyScenarioOverrides,
      "http://localhost/api/e2e-mock/data/serology/?eq(sample_identifier,000123)",
    );

    expect(browserGetRows).toEqual([serologyRecord]);
    expect(browserPostRows).toEqual([serologyRecord]);
    expect(browserLoopbackDocs).toEqual([
      serologyRecord,
      ...ambiguousSerologyRecords,
    ]);
    expect(serverBody.response.docs).toEqual([serologyRecord]);
  });

  it("protein_structure 6VXX/7BV2 — identical records across transports (GET + POST)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/protein_structure/?eq(pdb_id,*)",
      }),
      routeContext(["data", "protein_structure"]),
    );
    const serverBody = (await resp.json()) as {
      response: { docs: unknown[] };
    };
    const browserGetRows = gatewayRowsFromBundle(
      proteinStructureScenarioOverrides,
      "GET",
      "http://localhost/api/data/protein_structure?eq(pdb_id,*)",
    );
    const browserPostRows = gatewayRowsFromBundle(
      proteinStructureScenarioOverrides,
      "POST",
      "http://localhost/api/data/protein_structure",
    );

    expect(browserGetRows).toEqual(proteinStructureRecords);
    expect(browserPostRows).toEqual(proteinStructureRecords);
    expect(serverBody.response.docs).toEqual(proteinStructureRecords);
  });
});
