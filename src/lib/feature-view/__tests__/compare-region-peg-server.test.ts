import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { compareRegionNoBrcIdReason } from "../compare-region-peg";
import { resolveCompareRegionAvailability } from "../compare-region-peg-server";
import { featureViewRecordSchema } from "../schema";

const dataApiOrigin = "https://data.example";

function answer(docs: unknown[]): { urls: string[]; ranges: (string | null)[] } {
  const urls: string[] = [];
  const ranges: (string | null)[] = [];
  server.use(
    http.get(`${dataApiOrigin}/genome_feature/`, ({ request }) => {
      urls.push(decodeURIComponent(request.url));
      ranges.push(request.headers.get("range"));
      return HttpResponse.json({
        response: { numFound: docs.length, docs },
      });
    }),
  );
  return { urls, ranges };
}

const refseqThrA = featureViewRecordSchema.parse({
  feature_id: "RefSeq.511145.12.NC_000913.CDS.337.2799.fwd",
  genome_id: "511145.12",
  annotation: "RefSeq",
  feature_type: "CDS",
  sequence_id: "NC_000913",
  end: 2799,
  strand: "+",
});

let originalUrl: string | undefined;

beforeEach(() => {
  originalUrl = process.env.DATA_API_URL;
  process.env.DATA_API_URL = dataApiOrigin;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  if (originalUrl === undefined) Reflect.deleteProperty(process.env, "DATA_API_URL");
  else process.env.DATA_API_URL = originalUrl;
  vi.restoreAllMocks();
});

describe("resolveCompareRegionAvailability", () => {
  it("asks nothing of the Data API when the feature has its own BRC ID, of any type", async () => {
    const { urls } = answer([]);
    const trna = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      annotation: "PATRIC",
      feature_type: "tRNA",
      patric_id: "fig|511145.12.rna.7",
    });

    await expect(resolveCompareRegionAvailability(trna)).resolves.toEqual({
      peg: "fig|511145.12.rna.7",
    });
    expect(urls).toEqual([]);
  });

  it("finds a RefSeq CDS's PATRIC counterpart by sequence, end and strand", async () => {
    const { urls, ranges } = answer([
      { feature_id: "PATRIC.511145.12.NC_000913.CDS.337.2799.fwd", patric_id: "fig|511145.12.peg.1" },
    ]);

    await expect(resolveCompareRegionAvailability(refseqThrA)).resolves.toEqual({
      peg: "fig|511145.12.peg.1",
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(
      'and(eq(annotation,PATRIC),eq(genome_id,511145.12),eq(feature_type,CDS),eq(sequence_id,NC_000913),eq(end,2799),eq(strand,"+"))',
    );
    expect(urls[0]).toContain("select(feature_id,patric_id)");
    expect(ranges).toEqual(["items=0-1"]);
  });

  it("looks a RefSeq tRNA's own type up", async () => {
    const { urls } = answer([{ feature_id: "PATRIC.t", patric_id: "fig|511145.12.rna.7" }]);
    const trna = featureViewRecordSchema.parse({ ...refseqThrA, feature_type: "tRNA" });

    await expect(resolveCompareRegionAvailability(trna)).resolves.toEqual({
      peg: "fig|511145.12.rna.7",
    });
    expect(urls[0]).toContain("eq(feature_type,tRNA)");
  });

  it("says the feature has no BRC ID when no counterpart exists", async () => {
    answer([]);
    await expect(resolveCompareRegionAvailability(refseqThrA)).resolves.toEqual({
      peg: null,
      reason: compareRegionNoBrcIdReason,
    });
  });

  it("does not take a counterpart without a fig| BRC ID", async () => {
    answer([{ feature_id: "PATRIC.x" }]);
    await expect(resolveCompareRegionAvailability(refseqThrA)).resolves.toEqual({
      peg: null,
      reason: compareRegionNoBrcIdReason,
    });
  });

  it("keeps the upstream message when the lookup fails, and does not throw", async () => {
    server.use(
      http.get(`${dataApiOrigin}/genome_feature/`, () =>
        HttpResponse.text("Service Unavailable", { status: 503 }),
      ),
    );

    const availability = await resolveCompareRegionAvailability(refseqThrA);

    expect(availability.peg).toBeNull();
    expect(availability.reason).toMatch(/^Could not look up this feature's BRC ID/);
    expect(availability.reason).toMatch(/HTTP 503/);
    expect(console.error).toHaveBeenCalled();
  });
});
