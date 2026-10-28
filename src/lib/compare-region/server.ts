import "server-only";

/**
 * Server side of `/api/compare-region`: validates the request, calls the SEED
 * compare_regions service and maps its answer to `CompareRegionRow`s.
 * Contract in `docs/architecture.md` → "Compare Region route contract".
 */
import { z } from "zod";
import {
  UpstreamError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { isPatricFeatureId } from "@/lib/feature-view/schema";
import { JsonRpcClient } from "@/lib/jsonrpc-client";
import { noop } from "@/lib/utils";
import {
  parseCompareRegionSettings,
  type CompareRegionFeature,
  type CompareRegionFilter,
  type CompareRegionMethod,
  type CompareRegionQuery,
  type CompareRegionRow,
} from "./contract";

const maxPegLength = 200;

/** The request's query as a `CompareRegionQuery`, or null when any part is invalid. */
export function parseCompareRegionQuery(
  params: Pick<URLSearchParams, "get">,
): CompareRegionQuery | null {
  const peg = params.get("peg")?.trim() ?? "";
  if (peg.length > maxPegLength || !isPatricFeatureId(peg)) return null;
  const settings = parseCompareRegionSettings((name) => params.get(name));
  return settings ? { peg, ...settings } : null;
}

/** The service's names for our genome-set tokens. */
const serviceFilters: Record<CompareRegionFilter, string> = {
  reference: "representative+reference",
  all: "all",
  genomeGroup: "genome_group",
  featureGroup: "feature_group",
};

/**
 * The service's options argument: a group filter names its group's workspace
 * path there, as legacy BV-BRC sends it (`{genome_group: path}`).
 */
function serviceOptions(query: CompareRegionQuery): Record<string, string> {
  if (query.group === null) return {};
  if (query.filter === "genomeGroup") return { genome_group: query.group };
  if (query.filter === "featureGroup") return { feature_group: query.group };
  return {};
}

export class CompareRegionBusyError extends Error {
  constructor() {
    super(
      "The compare region service is busy with other requests. Please try again in a minute.",
    );
    this.name = "CompareRegionBusyError";
  }
}

/**
 * The service answers one request at a time per client address: a request
 * that overlaps another gets nginx's 503 at once (measured 2026-10-23). Every
 * DXKB user reaches it from this server, so requests take turns here. At most
 * `maxInLine` are in line, the running one included; one more is refused
 * rather than left waiting minutes.
 */
const maxInLine = 4;
let inLine = 0;
let lastTurn: Promise<unknown> = Promise.resolve();

function takeTurn<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (inLine >= maxInLine) return Promise.reject(new CompareRegionBusyError());
  inLine += 1;
  const run = lastTurn
    .then(() => {
      // A caller that left while waiting starts nothing.
      signal?.throwIfAborted();
      return task();
    })
    .finally(() => {
      inLine -= 1;
    });
  lastTurn = run.catch(noop);
  return run;
}

function serviceUrl(): string {
  const url = process.env.COMPARE_REGION_SERVICE_URL;
  if (url) return url;
  // The variable's name is for the server log; the user reads the reason.
  console.error(
    "The Compare Region Viewer needs COMPARE_REGION_SERVICE_URL, which is not set.",
  );
  throw new UpstreamError({
    status: 503,
    code: "service_unavailable",
    message: "The Compare Region Viewer is not configured on this server.",
  });
}

const strand = z.enum(["+", "-"]);

/** Coordinates and identity arrive as strings or numbers; coerce them. */
const rawFeatureSchema = z.object({
  fid: z.string().min(1),
  type: z.string(),
  beg: z.coerce.number(),
  end: z.coerce.number(),
  strand: strand.nullish(),
  function: z.string().nullish(),
  set_number: z.number().int().nullish(),
  blast_identity: z.coerce.number().nullish(),
  reference_point: z.number().nullish(),
  attributes: z.array(z.array(z.unknown())).nullish(),
});
type RawFeature = z.infer<typeof rawFeatureSchema>;

const rawRowSchema = z.object({
  genome_id: z.string().nullish(),
  org_name: z.string().nullish(),
  beg: z.coerce.number(),
  end: z.coerce.number(),
  contig_length: z.coerce.number().nullish(),
  pinned_peg: z.string().nullish(),
  pinned_peg_strand: strand.nullish(),
  features: z.array(z.unknown()),
});
type RawRow = z.infer<typeof rawRowSchema>;

/** Never drawn: legacy skipped active sites, and intergenic gaps are not features. */
const skippedTypes = new Set(["site_annotation", "intergenic"]);
/** The service numbers its rows in the name ("(0) Brucella suis …"); the order already says it. */
const rowNumber = /^\(\d+\)\s*/;

function toFeature(raw: RawFeature, method: CompareRegionMethod): CompareRegionFeature {
  const familyId = raw.attributes?.find((entry) => entry[0] === method)?.[1];
  return {
    fid: raw.fid,
    type: raw.type,
    start: raw.beg,
    end: raw.end,
    strand: raw.strand ?? null,
    product: raw.function ?? "",
    family: raw.set_number ?? null,
    familyId: typeof familyId === "string" ? familyId : null,
    identity: raw.blast_identity ?? null,
  };
}

function toRow(raw: RawRow, method: CompareRegionMethod): CompareRegionRow | null {
  const { genome_id: genomeId, pinned_peg: pinnedFid } = raw;
  if (!genomeId || !pinnedFid) return null;
  // A feature the schema cannot read is dropped, not the whole answer.
  const features = raw.features.flatMap((item) => {
    const parsed = rawFeatureSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const pinned = features.find((feature) => feature.fid === pinnedFid);
  const center = pinned?.reference_point;
  const pinnedStrand = raw.pinned_peg_strand ?? pinned?.strand;
  if (center == null || !pinnedStrand) return null;
  return {
    genomeId,
    genomeName: (raw.org_name ?? "").replace(rowNumber, "") || genomeId,
    start: raw.beg,
    end: raw.end,
    contigLength: raw.contig_length ?? null,
    pinnedFid,
    pinnedStrand,
    center,
    features: features
      .filter((feature) => !skippedTypes.has(feature.type))
      .map((feature) => toFeature(feature, method)),
  };
}

function unreadableAnswer(): UpstreamError {
  return new UpstreamError({
    status: 502,
    code: "upstream_error",
    message:
      "The BV-BRC compare region service sent an answer DXKB could not read.",
  });
}

/**
 * The service's rows as the route answers them. Every row is aligned against
 * the first (the focus gene's), so without it there is nothing to show. An
 * unknown gene comes back as one row with no genome and no pinned gene
 * (measured 2026-10-23), which reads as no rows. No rows at all, a focus row
 * that names only one of the two, and one that names both but cannot be read
 * are failures, so a changed answer is not reported as an unknown gene. Any
 * other row that lost its pinned gene is dropped.
 */
export function normalizeCompareRegionRows(
  raw: unknown,
  method: CompareRegionMethod,
): CompareRegionRow[] {
  const parsed = z.array(rawRowSchema).safeParse(raw);
  if (!parsed.success) throw unreadableAnswer();
  const focus = parsed.data.at(0);
  if (!focus) throw unreadableAnswer();
  if (!focus.genome_id && !focus.pinned_peg) return [];
  const rows = parsed.data.map((row) => toRow(row, method));
  if (!rows.at(0)) throw unreadableAnswer();
  return rows.filter((row) => row !== null);
}

/**
 * The focus gene's neighborhood in `query.genomes` other genomes. `token` is
 * the caller's session token (private genomes); anonymous callers see public
 * data. A group filter needs the token too: the service reads the group from
 * the caller's workspace with it, so the route refuses one without a session.
 * Throws `CompareRegionBusyError` when too many requests are in line,
 * and `UpstreamError`/`JsonRpcError` when the service fails, is not
 * configured, or sends an answer this module cannot read.
 */
export async function readCompareRegion(
  query: CompareRegionQuery,
  token: string | undefined,
  signal?: AbortSignal,
): Promise<CompareRegionRow[]> {
  const client = new JsonRpcClient(serviceUrl(), token, {
    service: upstreamServices.compareRegion,
    timeoutMs: upstreamTimeoutMs.compareRegion,
  });
  const result = await takeTurn(
    () =>
      client.call("SEED.compare_regions_for_peg2", [
        query.peg,
        query.size,
        query.genomes,
        query.method,
        serviceFilters[query.filter],
        serviceOptions(query),
      ]),
    signal,
  );
  // The rows come as `[rows]`; any other result (`null`) is unreadable.
  return normalizeCompareRegionRows(
    Array.isArray(result) ? result.at(0) : undefined,
    query.method,
  );
}
