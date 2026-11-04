import "server-only";

/**
 * The Circular Viewer's server-side contract with the Data API: request
 * parsing, the RQL clauses, row mapping and the GC windows. Reachable only
 * from `/api/circular-viewer/[operation]`; see `docs/architecture.md` →
 * "Circular Viewer route contract".
 *
 * Clauses are appended verbatim (they do not pass `validateRql`): every value
 * in them is a validated genome id, an entry of an allowlist in
 * `./contract.ts`, keyword text that `keywordClauses` percent-encodes, or a
 * `patric_id` that `patricIdPattern` accepts, quoted and percent-encoded.
 */
import { asInteger } from "@/lib/genome-browser/contract";
import { DataApiError, type ServerDataRepository } from "@/lib/data-api/repository";
import { DataApiValidationError } from "@/lib/data-api/resources";
import { keywordClauses } from "@/lib/data-api/rql";
import { maxSelectedRows } from "@/lib/data-api/validation";
import { isGenomeId } from "@/lib/genome-view/schema";
import {
  customFeatureTypes,
  customStrands,
  gcWindowSize,
  isCustomFeatureType,
  isCustomStrand,
  isPresetTrackId,
  maxContigs,
  maxGcGenomeLength,
  maxKeywordLength,
  maxTrackFeatures,
  presetTrackIds,
  type CircularContig,
  type CircularContigsResult,
  type CircularFeature,
  type CircularTrackResult,
  type CustomFeatureType,
  type CustomStrand,
  type CustomTrackQuery,
  type FeaturePresetId,
  type GcResult,
  type PresetTrackId,
  type SpecialtyPresetId,
} from "./contract";
import { gcWindows } from "./gc";

function requiredParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value === "") {
    throw new DataApiValidationError(`${name} is required.`);
  }
  return value;
}

function parseGenomeId(params: URLSearchParams): string {
  const value = requiredParam(params, "genomeId");
  if (!isGenomeId(value)) {
    throw new DataApiValidationError(
      "genomeId must be a genome id such as 83332.12.",
    );
  }
  return value;
}

export function parseGenomeQuery(params: URLSearchParams): { genomeId: string } {
  return { genomeId: parseGenomeId(params) };
}

export function parseTrackQuery(params: URLSearchParams): {
  genomeId: string;
  preset: PresetTrackId;
} {
  const genomeId = parseGenomeId(params);
  const preset = requiredParam(params, "preset");
  if (!isPresetTrackId(preset)) {
    throw new DataApiValidationError(
      `preset must be one of ${presetTrackIds.join(", ")}.`,
    );
  }
  return { genomeId, preset };
}

export function parseCustomQuery(
  params: URLSearchParams,
): { genomeId: string } & CustomTrackQuery {
  const genomeId = parseGenomeId(params);
  const type = requiredParam(params, "type");
  if (!isCustomFeatureType(type)) {
    throw new DataApiValidationError(
      `type must be one of ${customFeatureTypes.join(", ")}.`,
    );
  }
  const strand = requiredParam(params, "strand");
  if (!isCustomStrand(strand)) {
    throw new DataApiValidationError(
      `strand must be one of ${customStrands.join(", ")}.`,
    );
  }
  const keyword = requiredParam(params, "keyword").trim();
  if (keyword.length > maxKeywordLength) {
    throw new DataApiValidationError(
      `keyword must be at most ${String(maxKeywordLength)} characters.`,
    );
  }
  if (keywordClauses(keyword, "exact").length === 0) {
    throw new DataApiValidationError("keyword must contain a word to search for.");
  }
  return { genomeId, type, strand, keyword };
}

const featureFields = [
  "feature_id",
  "patric_id",
  "accession",
  "start",
  "end",
  "strand",
  "feature_type",
  "product",
  "gene",
  "refseq_locus_tag",
  "protein_id",
  "na_length",
  "aa_length",
] as const;

const patricAnnotation = "eq(annotation,PATRIC)";
/** Quoted and percent-encoded: a bare `+` in a query string reads as a space. */
const forwardStrand = "eq(strand,%22%2B%22)";
const reverseStrand = "eq(strand,%22-%22)";

/** Legacy `onSetReferenceSequences`'s three feature tracks. */
export const featurePresetFilters: Record<FeaturePresetId, string> = {
  "cds-forward": `and(${patricAnnotation},eq(feature_type,CDS),${forwardStrand})`,
  "cds-reverse": `and(${patricAnnotation},eq(feature_type,CDS),${reverseStrand})`,
  "non-cds": `and(${patricAnnotation},ne(feature_type,CDS))`,
};

/** Legacy `addSpGeneTrack`'s four `sp_gene` properties. */
export const specialtyProperties = {
  amr: "Antibiotic Resistance",
  vf: "Virulence Factor",
  transporter: "Transporter",
  "drug-target": "Drug Target",
} as const satisfies Record<SpecialtyPresetId, string>;

/** An `sp_gene` property the clauses may name: only the allowlist's. */
export type SpecialtyProperty = (typeof specialtyProperties)[SpecialtyPresetId];

const customTypeFilters: Record<CustomFeatureType, string> = {
  CDS: "eq(feature_type,CDS)",
  RNA: "eq(feature_type,*RNA)",
  Miscellaneous: "not(in(feature_type,(CDS,*RNA,source)))",
};

const customStrandFilters: Record<CustomStrand, string | null> = {
  both: null,
  forward: forwardStrand,
  reverse: reverseStrand,
};

/**
 * Legacy `addCustomTrack`: PATRIC features of the chosen type and strand
 * matching the keyword as the search box reads it (`searchToQuery`, here
 * `keywordClauses`: `a OR b` is `or(keyword(a),keyword(b))`).
 */
export function customTrackFilter(query: CustomTrackQuery): string {
  const strand = customStrandFilters[query.strand];
  return `and(${[
    patricAnnotation,
    customTypeFilters[query.type],
    ...(strand === null ? [] : [strand]),
    ...keywordClauses(query.keyword, "exact"),
  ].join(",")})`;
}

export function featureTrackClause(genomeId: string, filter: string): string {
  return `and(eq(genome_id,${genomeId}),ne(feature_type,source),${filter})&select(${featureFields.join(",")})&sort(+accession,+start)`;
}

export function contigsClause(genomeId: string): string {
  return `eq(genome_id,${genomeId})&select(sequence_id,accession,length,gc_content,topology,sequence_type)&sort(+accession)`;
}

/** Only the lengths: what the GC limit is checked against before any sequence is read. */
export function contigLengthsClause(genomeId: string): string {
  return `eq(genome_id,${genomeId})&select(sequence_id,accession,length)&sort(+accession)`;
}

export function contigSequencesClause(genomeId: string): string {
  // `sequence_id` too: `genomeSequenceRecordSchema` requires it of every row.
  return `eq(genome_id,${genomeId})&select(sequence_id,accession,sequence)&sort(+accession)`;
}

/**
 * Sorted by gene (every live row has a `patric_id`; `+id` breaks any tie), so
 * the windows `readSpecialtyGenes` pages through are deterministic.
 */
export function specialtyGenesClause(genomeId: string, property: SpecialtyProperty): string {
  return `and(eq(genome_id,${genomeId}),eq(property,${encodeURIComponent(`"${property}"`)}))&select(id,feature_id,patric_id)&sort(+patric_id,+id)`;
}

/** A PATRIC feature's `patric_id`, such as `fig|83332.12.peg.1`: the only shape a clause may name. */
const patricIdPattern = /^fig\|\d+\.\d+\.[a-z]+\.\d+$/;

/** 100 quoted, percent-encoded `patric_id`s are about 4 KB of URL. */
const patricIdsPerRead = 100;

/** The features of `patric_id`s that `patricIdPattern` accepted, each quoted and percent-encoded. */
export function patricIdFeaturesClause(genomeId: string, patricIds: readonly string[]): string {
  const values = patricIds.map((id) => encodeURIComponent(`"${id}"`)).join(",");
  return `and(eq(genome_id,${genomeId}),in(patric_id,(${values})))&select(${featureFields.join(",")})`;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function decimal(value: unknown): number | undefined {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

/** Copies the entries of `optional` whose value is not `undefined`, so an absent field stays absent. */
function assignDefined(target: object, optional: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(target, { [key]: value });
  }
}

export function toCircularFeature(row: Record<string, unknown>): CircularFeature | null {
  const featureId = text(row.feature_id);
  const accession = text(row.accession);
  const start = asInteger(row.start);
  const end = asInteger(row.end);
  if (
    featureId === undefined ||
    accession === undefined ||
    start === undefined ||
    end === undefined ||
    start < 1 ||
    end < start
  ) {
    return null;
  }
  const feature: CircularFeature = {
    featureId,
    accession,
    start,
    end,
    strand: row.strand === "+" || row.strand === "-" ? row.strand : null,
    featureType: text(row.feature_type) ?? "feature",
  };
  const optional = {
    patricId: text(row.patric_id),
    product: text(row.product),
    gene: text(row.gene),
    refseqLocusTag: text(row.refseq_locus_tag),
    proteinId: text(row.protein_id),
    naLength: asInteger(row.na_length),
    aaLength: asInteger(row.aa_length),
  };
  assignDefined(feature, optional);
  return feature;
}

/** The contig for a row `contigRow` validated: its accession and length are the validated pair. */
export function toCircularContig(
  row: Record<string, unknown>,
  { accession, length }: { accession: string; length: number },
): CircularContig {
  const contig: CircularContig = {
    accession,
    sequenceId: text(row.sequence_id) ?? accession,
    length,
  };
  const optional = {
    gcContent: decimal(row.gc_content),
    topology: text(row.topology),
    sequenceType: text(row.sequence_type),
  };
  assignDefined(contig, optional);
  return contig;
}

function mapFeatures(rows: readonly Record<string, unknown>[]): CircularFeature[] {
  return rows.flatMap((row) => {
    const feature = toCircularFeature(row);
    return feature ? [feature] : [];
  });
}

function byPosition(a: CircularFeature, b: CircularFeature): number {
  if (a.accession !== b.accession) return a.accession < b.accession ? -1 : 1;
  return a.start - b.start;
}

function malformedSequence(genomeId: string, row: Record<string, unknown>, problem: string): DataApiError {
  const sequenceId = text(row.sequence_id) ?? "(no sequence_id)";
  return new DataApiError(
    `Malformed genome_sequence response for genome ${genomeId}, sequence_id ${sequenceId}: ${problem}.`,
    502,
    "malformed_response",
  );
}

/**
 * The one rule for a `genome_sequence` row's accession and length, used by the
 * contig list and the GC lengths read: an accession and a whole, non-negative
 * length, or the answer is a wrong shape (a row dropped here would take its
 * features off the figure without a word). A length of 0 is skipped, since
 * nothing can sit on an empty sequence and `buildGenomeLayout` skips it too.
 * The GC sequence read applies the matching accession check and skips the
 * empty sequence of a length-0 row (and only that one), so its contigs are the
 * same set.
 */
function contigRow(
  genomeId: string,
  row: Record<string, unknown>,
): { accession: string; length: number } | undefined {
  const accession = text(row.accession);
  if (accession === undefined) throw malformedSequence(genomeId, row, "no accession");
  const length = asInteger(row.length);
  if (length === undefined || length < 0) {
    const problem =
      row.length === undefined || row.length === null
        ? "length is missing"
        : `length ${JSON.stringify(row.length)} is not a whole number of 0 or more`;
    throw malformedSequence(genomeId, row, problem);
  }
  return length === 0 ? undefined : { accession, length };
}

/** `rangedRows` takes an exclusive end, so `maxContigs + 1` asks for one row more than kept. */
export async function readContigs(
  repository: ServerDataRepository,
  genomeId: string,
  signal?: AbortSignal,
): Promise<CircularContigsResult> {
  const { rows } = await repository.rangedRows(
    "genome_sequence",
    contigsClause(genomeId),
    0,
    maxContigs + 1,
    signal,
  );
  return {
    contigs: rows.slice(0, maxContigs).flatMap((row) => {
      const valid = contigRow(genomeId, row);
      return valid === undefined ? [] : [toCircularContig(row, valid)];
    }),
    truncated: rows.length > maxContigs,
  };
}

export async function readFeatureTrack(
  repository: ServerDataRepository,
  genomeId: string,
  filter: string,
  signal?: AbortSignal,
): Promise<CircularTrackResult> {
  const { rows } = await repository.rangedRows(
    "genome_feature",
    featureTrackClause(genomeId, filter),
    0,
    maxTrackFeatures + 1,
    signal,
  );
  return {
    features: mapFeatures(rows.slice(0, maxTrackFeatures)),
    truncated: rows.length > maxTrackFeatures,
  };
}

/** A gene as `sp_gene` lists it: CARD and NDARO rows name it by `patric_id` alone. */
interface SpecialtyGene {
  patricId: string | undefined;
  featureId: string | undefined;
}

/**
 * The first `maxTrackFeatures` genes with the property, keyed by `patric_id`
 * (`feature_id` for a row without one). `sp_gene` has a row per source that
 * lists a gene, so its rows are read `maxTrackFeatures` at a time until more
 * genes than that are known or a window comes back short. A window that adds
 * no gene ends the read too, so an upstream that ignored the range cannot
 * keep it paging.
 */
async function readSpecialtyGenes(
  repository: ServerDataRepository,
  genomeId: string,
  property: SpecialtyProperty,
  signal?: AbortSignal,
): Promise<{ genes: SpecialtyGene[]; truncated: boolean }> {
  const clause = specialtyGenesClause(genomeId, property);
  const genes = new Map<string, SpecialtyGene>();
  for (let start = 0; ; start += maxTrackFeatures) {
    const known = genes.size;
    const { rows } = await repository.rangedRows(
      "sp_gene",
      clause,
      start,
      start + maxTrackFeatures,
      signal,
    );
    for (const row of rows) {
      const patricId = text(row.patric_id);
      const featureId = text(row.feature_id);
      const key = patricId ?? featureId;
      if (key === undefined) continue;
      const gene = genes.get(key);
      if (gene === undefined) genes.set(key, { patricId, featureId });
      else gene.featureId ??= featureId;
    }
    if (
      genes.size > maxTrackFeatures ||
      rows.length < maxTrackFeatures ||
      genes.size === known
    ) {
      break;
    }
  }
  return {
    genes: [...genes.values()].slice(0, maxTrackFeatures),
    truncated: genes.size > maxTrackFeatures,
  };
}

/**
 * Legacy `addSpGeneTrack`: the genome's `sp_gene` genes with the property,
 * then their features, each read once. A gene with a `feature_id` is read
 * through POST, `maxSelectedRows` (the Data API's `in(...)` ceiling) per
 * request; one listed only by `patric_id` through a ranged GET,
 * `patricIdsPerRead` per request, skipping an id `patricIdPattern` refuses.
 */
export async function readSpecialtyTrack(
  repository: ServerDataRepository,
  genomeId: string,
  property: SpecialtyProperty,
  signal?: AbortSignal,
): Promise<CircularTrackResult> {
  const { genes, truncated } = await readSpecialtyGenes(repository, genomeId, property, signal);
  const featureIds = [
    ...new Set(genes.flatMap(({ featureId }) => (featureId === undefined ? [] : [featureId]))),
  ];
  const patricIds = genes.flatMap(({ patricId, featureId }) =>
    featureId === undefined && patricId !== undefined && patricIdPattern.test(patricId)
      ? [patricId]
      : [],
  );
  const features: CircularFeature[] = [];
  for (let offset = 0; offset < featureIds.length; offset += maxSelectedRows) {
    const result = await repository.execute(
      "genome_feature",
      {
        operation: "selected",
        ids: featureIds.slice(offset, offset + maxSelectedRows),
        fields: [...featureFields],
      },
      signal,
    );
    // Narrows `execute`'s union to the rows a `selected` read answers. An
    // empty `rows` is an empty track; an answer without `rows` is a wrong
    // shape, so it fails rather than drawing the track empty.
    if (!("rows" in result)) {
      throw new DataApiError(
        "Malformed genome_feature response: expected rows for the specialty genes' features.",
        502,
        "malformed_response",
      );
    }
    features.push(...mapFeatures(result.rows));
  }
  for (let offset = 0; offset < patricIds.length; offset += patricIdsPerRead) {
    const ids = patricIds.slice(offset, offset + patricIdsPerRead);
    // The window is the per-request ceiling, not the ids' count: the API
    // answers only matching rows, and a `patric_id` that named two features
    // would keep both.
    const { rows } = await repository.rangedRows(
      "genome_feature",
      patricIdFeaturesClause(genomeId, ids),
      0,
      maxSelectedRows,
      signal,
    );
    features.push(...mapFeatures(rows));
  }
  // A gene keyed by `feature_id` and one keyed by `patric_id` can be one feature.
  const unique = [...new Map(features.map((feature) => [feature.featureId, feature])).values()];
  unique.sort(byPosition);
  return { features: unique, truncated };
}

function genomeTooLong(genomeId: string, genomeLength: number, limit: number): DataApiError {
  return new DataApiError(
    `Genome ${genomeId} is ${genomeLength.toLocaleString("en-US")} bp long, more than the ${limit.toLocaleString("en-US")} bp the Circular Viewer's GC tracks read.`,
    422,
    "genome_too_long",
  );
}

/** The GC answer for sequences already read. `limit` is a test seam for `maxGcGenomeLength`. */
export function gcResult(
  genomeId: string,
  sequences: readonly { accession: string; sequence: string }[],
  limit = maxGcGenomeLength,
): GcResult {
  const genomeLength = sequences.reduce((sum, item) => sum + item.sequence.length, 0);
  if (genomeLength > limit) throw genomeTooLong(genomeId, genomeLength, limit);
  const windowSize = gcWindowSize(genomeLength);
  return {
    windowSize,
    contigs: sequences.map(({ accession, sequence }) => ({
      accession,
      length: sequence.length,
      ...gcWindows(sequence, windowSize),
    })),
  };
}

/**
 * One GC read holds up to about 30 MB of body plus its parsed strings, and
 * nothing is cached, so at most `maxGcReads` run at once per process (the
 * module state is per Node process, like Compare Region's line); one past the
 * cap is refused rather than left to pile up memory.
 */
const maxGcReads = 4;
let gcReadsInFlight = 0;

/**
 * The same first `maxContigs` sequences `readContigs` answers, read whole.
 * Their lengths are read first, so a genome over `limit` (a test seam for
 * `maxGcGenomeLength`) is refused before any of its sequence is downloaded;
 * `gcResult` checks the sequences' own lengths again.
 */
export async function readGc(
  repository: ServerDataRepository,
  genomeId: string,
  signal?: AbortSignal,
  limit = maxGcGenomeLength,
): Promise<GcResult> {
  const lengths = await repository.rangedRows(
    "genome_sequence",
    contigLengthsClause(genomeId),
    0,
    maxContigs,
    signal,
  );
  const genomeLength = lengths.rows.reduce(
    (sum, row) => sum + (contigRow(genomeId, row)?.length ?? 0),
    0,
  );
  if (genomeLength > limit) throw genomeTooLong(genomeId, genomeLength, limit);
  // The accessions `contigRow` skipped for a length of 0, whose sequences are empty.
  const emptyAccessions = new Set(
    lengths.rows.flatMap((row) => (asInteger(row.length) === 0 ? [text(row.accession) ?? ""] : [])),
  );
  if (gcReadsInFlight >= maxGcReads) {
    throw new DataApiError(
      "The Circular Viewer's GC service is busy reading other genomes. Please try again shortly.",
      503,
      "server_busy",
    );
  }
  gcReadsInFlight += 1;
  try {
    const { rows } = await repository.rangedRows(
      "genome_sequence",
      contigSequencesClause(genomeId),
      0,
      maxContigs,
      signal,
    );
    return gcResult(
      genomeId,
      rows.flatMap((row) => {
        const accession = text(row.accession);
        if (accession === undefined) throw malformedSequence(genomeId, row, "no accession");
        if (typeof row.sequence !== "string") {
          throw malformedSequence(genomeId, row, `sequence of type ${row.sequence === null ? "null" : typeof row.sequence}, not a string`);
        }
        if (row.sequence === "") {
          // The empty sequence of a length-0 row, which `contigRow` skips; any other is a wrong shape.
          if (emptyAccessions.has(accession)) return [];
          throw malformedSequence(genomeId, row, "an empty sequence for a length above 0");
        }
        return [{ accession, sequence: row.sequence }];
      }),
      limit,
    );
  } finally {
    gcReadsInFlight -= 1;
  }
}
