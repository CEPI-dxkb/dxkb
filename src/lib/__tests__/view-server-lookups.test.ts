// `server-only` throws outside Next's bundler; neutralize it as dataset-store.test.ts does.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { z } from "zod";
import { server } from "@/test-helpers/msw-server";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { getEpitope } from "@/lib/epitope-view/server";
import { getExperiment } from "@/lib/experiment-view/server";
import { getFeature } from "@/lib/feature-view/server";
import { getGenome } from "@/lib/genome-view/server";
import { getStrain } from "@/lib/strain-view/server";

const dataApiOrigin = "https://data.example";

function upstream(resource: string, rows: unknown[]): { urls: string[] } {
  const urls: string[] = [];
  server.use(
    http.get(`${dataApiOrigin}/${resource}/`, ({ request }) => {
      urls.push(decodeURIComponent(request.url));
      return HttpResponse.json(rows);
    }),
  );
  return { urls };
}

const envVarNames = ["DATA_API_URL", "NEXT_PUBLIC_DATA_API"] as const;
const originalEnv: Partial<Record<(typeof envVarNames)[number], string>> = {};

beforeEach(() => {
  for (const name of envVarNames) originalEnv[name] = process.env[name];
  process.env.DATA_API_URL = dataApiOrigin;
  delete process.env.NEXT_PUBLIC_DATA_API;
});

afterEach(() => {
  for (const name of envVarNames) {
    if (originalEnv[name] === undefined)
      Reflect.deleteProperty(process.env, name);
    else process.env[name] = originalEnv[name];
  }
});

/** Which schema rejects a malformed row: `"view"` means the wrapper's own `*ViewRecordSchema.parse` throws, `"resource"` means `parseRows` rejects first (epitope's view schema is no stricter than `epitopeRecordSchema`). */
type MalformedLayer = "view" | "resource";

interface LookupCase {
  name: string;
  resource: string;
  id: string;
  lookup: (id: string) => Promise<unknown>;
  validRow: Record<string, unknown>;
  expected: unknown;
  empty: unknown;
  malformedRow: Record<string, unknown>;
  malformedLayer: MalformedLayer;
}

const lookupCases: LookupCase[] = [
  {
    name: "getGenome",
    resource: "genome",
    id: "83332.12",
    lookup: getGenome,
    validRow: { genome_id: "83332.12", genome_name: "Mycobacterium" },
    expected: { genome_id: "83332.12", genome_name: "Mycobacterium" },
    empty: null,
    // The resource schema accepts any non-empty `genome_id`; the view schema requires `<taxon>.<assembly>`.
    malformedRow: { genome_id: "not-a-genome-id" },
    malformedLayer: "view",
  },
  {
    name: "getFeature",
    resource: "genome_feature",
    id: "PATRIC.83332.12.NC_000962.CDS.1.1000.fwd",
    lookup: getFeature,
    validRow: { feature_id: "PATRIC.83332.12.NC_000962.CDS.1.1000.fwd" },
    expected: {
      feature: { feature_id: "PATRIC.83332.12.NC_000962.CDS.1.1000.fwd" },
      usedAlternateId: false,
    },
    empty: { feature: null, usedAlternateId: false },
    // `genomeFeatureRecordSchema` does not declare `taxon_lineage_names`, so a loose object passes it.
    malformedRow: { feature_id: "f1", taxon_lineage_names: 42 },
    malformedLayer: "view",
  },
  {
    name: "getEpitope",
    resource: "epitope",
    id: "EPI-1",
    lookup: getEpitope,
    validRow: { epitope_id: "EPI-1", epitope_type: "Linear peptide" },
    expected: { epitope_id: "EPI-1", epitope_type: "Linear peptide" },
    empty: null,
    malformedRow: { epitope_id: "EPI-1", epitope_type: 42 },
    malformedLayer: "resource",
  },
  {
    name: "getExperiment",
    resource: "experiment",
    id: "1234",
    lookup: getExperiment,
    validRow: { exp_id: "1234", study_name: "A study" },
    expected: { exp_id: "1234", study_name: "A study" },
    empty: null,
    // `experimentRecordSchema` declares only identifier and taxonomy fields, so a numeric `study_name` reaches the view schema.
    malformedRow: { exp_id: "1234", study_name: 42 },
    malformedLayer: "view",
  },
  {
    name: "getStrain",
    resource: "strain",
    id: "018372aa-097b-4373-892b-c9930b825955",
    lookup: getStrain,
    validRow: {
      id: "018372aa-097b-4373-892b-c9930b825955",
      strain: "A/China",
    },
    expected: {
      id: "018372aa-097b-4373-892b-c9930b825955",
      strain: "A/China",
    },
    empty: null,
    // `strainRecordSchema` declares only identifier, name, accession and taxonomy fields, so a numeric `subtype` reaches the view schema.
    malformedRow: { id: "strain-1", subtype: 42 },
    malformedLayer: "view",
  },
];

describe.each(lookupCases)(
  "$name",
  ({
    resource,
    id,
    lookup,
    validRow,
    expected,
    empty,
    malformedRow,
    malformedLayer,
  }) => {
    it("returns the parsed record for a matching row", async () => {
      upstream(resource, [validRow]);

      await expect(lookup(id)).resolves.toEqual(expected);
    });

    it("reports not-found rather than throwing when the upstream matches nothing", async () => {
      upstream(resource, []);

      await expect(lookup(id)).resolves.toEqual(empty);
    });

    it(`rejects a malformed row at the ${malformedLayer} schema`, async () => {
      upstream(resource, [malformedRow]);

      const rejection = lookup(id);
      if (malformedLayer === "resource") {
        await expect(rejection).rejects.toMatchObject({
          name: "DataApiError",
          status: 502,
          code: "malformed_response",
        });
      } else {
        await expect(rejection).rejects.toBeInstanceOf(z.ZodError);
      }
    });

    // Each wrapper lets the factory's configuration error propagate; only `protein-structure-view/server.ts` catches it, and it has its own spec.
    it("propagates the factory's not_configured error when no base URL is set", async () => {
      delete process.env.DATA_API_URL;

      await expect(lookup(id)).rejects.toMatchObject({
        name: "DataApiError",
        message: "DATA_API_URL is not configured.",
        status: 500,
        code: "not_configured",
      });
    });

    it("forwards the session token upstream for an authenticated caller", async () => {
      setTestSession({ token: "secret-token" });
      const seen: (string | null)[] = [];
      server.use(
        http.get(`${dataApiOrigin}/${resource}/`, ({ request }) => {
          seen.push(request.headers.get("Authorization"));
          return HttpResponse.json([validRow]);
        }),
      );

      await expect(lookup(id)).resolves.toEqual(expected);
      expect(seen).toEqual(["secret-token"]);
    });
  },
);

describe("getFeature alternate identifier", () => {
  const figId = "fig|83332.12.peg.1";

  it("looks a fig| identifier up by patric_id and reports the alternate ID", async () => {
    const { urls } = upstream("genome_feature", [
      { feature_id: "internal-1", patric_id: figId },
    ]);

    await expect(getFeature(figId)).resolves.toEqual({
      feature: { feature_id: "internal-1", patric_id: figId },
      usedAlternateId: true,
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("patric_id");
    expect(urls[0]).not.toContain("eq(feature_id");
  });

  it("looks any other identifier up by feature_id", async () => {
    const { urls } = upstream("genome_feature", [
      { feature_id: "internal-1" },
    ]);

    await expect(getFeature("internal-1")).resolves.toEqual({
      feature: { feature_id: "internal-1" },
      usedAlternateId: false,
    });
    expect(urls[0]).toContain("eq(feature_id");
  });

  // DXKBCORE-415: the Data API answers HTTP 400 for an apostrophe in an RQL
  // value however it is encoded, so the lookup sends `?` and keeps the exact
  // row (a RefSeq sibling shares the genome but not the ID).
  it.each([
    ["feature_id", "PATRIC.1173523.10.JQ434005.5'UTR.1.384.fwd", "eq(feature_id,PATRIC.1173523.10.JQ434005.5?UTR.1.384.fwd)"],
    ["patric_id", "fig|1173523.10.5'UTR.1", "eq(patric_id,fig|1173523.10.5?UTR.1)"],
  ])("loads a 5'UTR feature by %s", async (_field, id, clause) => {
    const row = {
      feature_id: "PATRIC.1173523.10.JQ434005.5'UTR.1.384.fwd",
      patric_id: "fig|1173523.10.5'UTR.1",
    };
    const { urls } = upstream("genome_feature", [
      row,
      { feature_id: "PATRIC.1173523.10.JQ434005.5xUTR.1.384.fwd", patric_id: "fig|1173523.10.5xUTR.1" },
    ]);

    await expect(getFeature(id)).resolves.toEqual({
      feature: row,
      usedAlternateId: id.startsWith("fig|"),
    });
    expect(urls[0]).toContain(clause);
    expect(urls[0]).not.toContain("'");
  });

  // The flag reports the identifier used, not whether a row came back; the page needs it to redirect even when the lookup misses.
  it("still reports the alternate ID when a fig| lookup matches nothing", async () => {
    upstream("genome_feature", []);

    await expect(getFeature(figId)).resolves.toEqual({
      feature: null,
      usedAlternateId: true,
    });
  });
});
