import { maxRqlInValues } from "@/lib/data-api/rql";
import { encodePathSegment, encodeQueryComponent } from "@/lib/url";
import { escapeRqlValue } from "./rql";

/**
 * Returns `null` when nothing usable is left or the set exceeds the Data API's
 * `in(...)` ceiling, since truncating would silently drop selected rows.
 */
function idListRql(
  field: string,
  values: readonly (string | number)[],
): string | null {
  const ids = [...new Set(values.map(String).map((id) => id.trim()))]
    .filter(Boolean)
    .map(escapeRqlValue);
  if (ids.length === 0 || ids.length > maxRqlInValues) return null;
  return `in(${field},(${ids.join(",")}))`;
}

export function taxonomyHref(taxonId: number | string): string {
  const id = String(taxonId);
  if (!/^(?=.*[1-9])\d+$/.test(id)) throw new Error(`Invalid Taxon ID: ${id}`);
  return `/taxonomy/${encodePathSegment(id)}`;
}

export function genomeIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const genomeId = row?.genome_id;
  return typeof genomeId === "string" || typeof genomeId === "number"
    ? String(genomeId)
    : null;
}

export function genomeHref(genomeId: number | string): string {
  return `/genome/${encodePathSegment(String(genomeId))}`;
}

export function genomesHrefFromIds(
  values: readonly (string | number)[],
): string | null {
  const rql = idListRql("genome_id", values);
  return rql ? genomeListHref({ rql }) : null;
}

export function genomeListHref(opts?: {
  keyword?: string;
  rql?: string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeQueryComponent(opts.rql)}`);
  if (opts?.keyword) params.push(`keyword=${encodeQueryComponent(opts.keyword)}`);
  return params.length ? `/genome?${params.join("&")}` : "/genome";
}

export function featureIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const featureId = row?.feature_id ?? row?.patric_id;
  return typeof featureId === "string" || typeof featureId === "number"
    ? String(featureId)
    : null;
}

export function featureHref(featureId: number | string): string {
  return `/feature/${encodePathSegment(String(featureId))}`;
}

export function featuresHrefFromIds(
  values: readonly (string | number)[],
): string | null {
  const rql = idListRql("feature_id", values);
  return rql ? featureListHref({ rql }) : null;
}

export function featureListHref(opts?: {
  keyword?: string;
  rql?: string;
  filter?: string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeQueryComponent(opts.rql)}`);
  if (opts?.keyword) params.push(`keyword=${encodeQueryComponent(opts.keyword)}`);
  if (opts?.filter) params.push(`filter=${encodeQueryComponent(opts.filter)}`);
  return params.length ? `/feature?${params.join("&")}` : "/feature";
}

export function epitopeIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const epitopeId = row?.epitope_id;
  return typeof epitopeId === "string" || typeof epitopeId === "number"
    ? String(epitopeId)
    : null;
}

export function epitopeHref(epitopeId: number | string): string {
  return `/epitope/${encodePathSegment(String(epitopeId))}`;
}

export function strainIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const strainId = row?.id;
  return typeof strainId === "string" || typeof strainId === "number"
    ? String(strainId)
    : null;
}

/**
 * Keyed by the record `id`, not the name: names are phrase-matched (`A/China`
 * also matches `A/China/27/2017`) and carry `/`.
 */
export function strainHref(strainId: number | string): string {
  return `/strain/${encodePathSegment(String(strainId))}`;
}

export function experimentIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const experimentId = row?.exp_id;
  return typeof experimentId === "string" || typeof experimentId === "number"
    ? String(experimentId)
    : null;
}

export function experimentHref(experimentId: number | string): string {
  return `/experiment/${encodePathSegment(String(experimentId))}`;
}

/** Legacy Bioset Results view; no canonical V2 route exists yet. */
export function biosetResultsHref(experimentIds: readonly string[]): string {
  const ids = [...new Set(experimentIds)].map(encodeURIComponent).join(",");
  return `https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(${ids}))`;
}

export function proteinStructureHref(accession: number | string): string {
  return `/protein-structure?accession=${encodeQueryComponent(String(accession))}`;
}

export function surveillanceIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const sampleIdentifier = row?.sample_identifier;
  return typeof sampleIdentifier === "string" ||
    typeof sampleIdentifier === "number"
    ? String(sampleIdentifier)
    : null;
}

export function surveillanceHref(
  sampleIdentifier: number | string,
  pathogenTestType?: string,
): string {
  const path = `/surveillance/${encodePathSegment(String(sampleIdentifier))}`;
  return pathogenTestType
    ? `${path}?pathogen_test_type=${encodeQueryComponent(pathogenTestType)}`
    : path;
}

export function serologyIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const sampleIdentifier = row?.sample_identifier;
  return typeof sampleIdentifier === "string" ||
    typeof sampleIdentifier === "number"
    ? String(sampleIdentifier)
    : null;
}

export function serologyHref(
  sampleIdentifier: number | string,
  testType?: string,
): string {
  const path = `/serology/${encodePathSegment(String(sampleIdentifier))}`;
  return testType ? `${path}?test_type=${encodeQueryComponent(testType)}` : path;
}
