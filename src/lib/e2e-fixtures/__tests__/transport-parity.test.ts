import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";
import { GET } from "@/app/api/e2e-mock/[...path]/route";
// `catchall.ts` imports `JsonOverride` from `e2e/mocks/backends.ts` as a type only; a value import would pull `@playwright/test` into this Vitest module.
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

/** Guards against the browser-side mock (`catchall.ts`) and the server-side loopback (`route.ts`) serving different record content for a resource. It diffs every static `JsonOverride` body that carries rows: gateway GET for all 7 resources, gateway POST for all but `genome` (dynamic body), and loopback GET only for `experiment`, `surveillance` and `serology`. */

function routeContext(path: string[]): { params: Promise<{ path: string[] }> } {
  return makeRouteContext({ path });
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

/** Finds the browser-side gateway override (`/api/data/<resource>`) for a method and returns its static rows; `sampleUrl` must not contain "e2e-mock". */
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

/** Finds the loopback-direct override and returns its static `response.docs`; `sampleUrl` must contain "e2e-mock". */
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
    // The gateway override returns only the primary record regardless of query, but the loopback-direct entry returns all 3 rows.
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
