// Centralized internal-URL construction for (views) routes. Keep path shape and
// query encoding here so callers do not hand-build strings (and re-derive encoding
// rules) at each site.

import { maxRqlInValues } from "@/lib/data-api/rql";
import { escapeRqlValue } from "./rql";

/**
 * Build an `in(field,(...))` clause from a selection's raw ID values, trimming and
 * de-duplicating first. Returns `null` when nothing usable is left, or when the set
 * exceeds the Data API's `in(...)` ceiling — the destination would reject the query,
 * and truncating would silently drop rows the user selected.
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

/** Internal taxonomy singular route, e.g. `/taxonomy/561`. */
export function taxonomyHref(taxonId: number | string): string {
  const id = String(taxonId);
  if (!/^(?=.*[1-9])\d+$/.test(id)) throw new Error(`Invalid Taxon ID: ${id}`);
  return `/taxonomy/${encodeURIComponent(id)}`;
}

/** Return a navigable Genome ID from an API row, if present. */
export function genomeIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const genomeId = row?.genome_id;
  return typeof genomeId === "string" || typeof genomeId === "number"
    ? String(genomeId)
    : null;
}

/** Internal genome singular route, e.g. `/genome/83332.12`. */
export function genomeHref(genomeId: number | string): string {
  return `/genome/${encodeURIComponent(String(genomeId))}`;
}

/** Return the canonical Genome list for the supplied genome IDs. */
export function genomesHrefFromIds(
  values: readonly (string | number)[],
): string | null {
  const rql = idListRql("genome_id", values);
  return rql ? genomeListHref({ rql }) : null;
}

/**
 * Internal genome list route, optionally pre-filtered by a friendly keyword or an
 * RQL string. Explicit RQL takes precedence when both are supplied.
 */
export function genomeListHref(opts?: {
  keyword?: string;
  rql?: string;
}): string {
  if (opts?.rql) return `/genome?rql=${encodeURIComponent(opts.rql)}`;
  if (opts?.keyword) {
    return `/genome?keyword=${encodeURIComponent(opts.keyword)}`;
  }
  return "/genome";
}

/** Return the canonical Feature ID from an API row, falling back for legacy search payloads. */
export function featureIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const featureId = row?.feature_id ?? row?.patric_id;
  return typeof featureId === "string" || typeof featureId === "number"
    ? String(featureId)
    : null;
}

/** Internal Feature member route. */
export function featureHref(featureId: number | string): string {
  return `/feature/${encodeURIComponent(String(featureId))}`;
}

/**
 * Feature list route for an explicit ID set — the Interactions tab's FEATURES action,
 * which pools both interactors of every selected row. Mirrors `genomesHrefFromIds`.
 */
export function featuresHrefFromIds(
  values: readonly (string | number)[],
): string | null {
  const rql = idListRql("feature_id", values);
  return rql ? featureListHref({ rql }) : null;
}

/**
 * Canonical Feature list route. Explicit RQL takes precedence over keyword;
 * `filter` is independent of both and is appended whenever it is supplied.
 */
export function featureListHref(opts?: {
  keyword?: string;
  rql?: string;
  filter?: string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else if (opts?.keyword)
    params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
  if (opts?.filter) params.push(`filter=${encodeURIComponent(opts.filter)}`);
  return params.length ? `/feature?${params.join("&")}` : "/feature";
}

/** Return a navigable Epitope ID from an API row, if present. */
export function epitopeIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const epitopeId = row?.epitope_id;
  return typeof epitopeId === "string" || typeof epitopeId === "number"
    ? String(epitopeId)
    : null;
}

/** Internal Epitope member route. */
export function epitopeHref(epitopeId: number | string): string {
  return `/epitope/${encodeURIComponent(String(epitopeId))}`;
}

/** Return a canonical Experiment ID from an API row, if present. */
export function experimentIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const experimentId = row?.exp_id;
  return typeof experimentId === "string" || typeof experimentId === "number"
    ? String(experimentId)
    : null;
}

/** Internal Experiment member route. */
export function experimentHref(experimentId: number | string): string {
  return `/experiment/${encodeURIComponent(String(experimentId))}`;
}

/** Legacy Bioset Results view; no canonical V2 result-analysis route exists yet. */
export function biosetResultsHref(experimentIds: readonly string[]): string {
  const ids = [...new Set(experimentIds)].map(encodeURIComponent).join(",");
  return `https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(${ids}))`;
}

/** Internal Protein Structure route using the canonical accession query. */
export function proteinStructureHref(accession: number | string): string {
  return `/protein-structure?accession=${encodeURIComponent(String(accession))}`;
}

/** Return a public Surveillance sample identifier from an API row, if present. */
export function surveillanceIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const sampleIdentifier = row?.sample_identifier;
  return typeof sampleIdentifier === "string" ||
    typeof sampleIdentifier === "number"
    ? String(sampleIdentifier)
    : null;
}

/** Internal Surveillance member route with an optional compound discriminator. */
export function surveillanceHref(
  sampleIdentifier: number | string,
  pathogenTestType?: string,
): string {
  const path = `/surveillance/${encodeURIComponent(String(sampleIdentifier))}`;
  return pathogenTestType
    ? `${path}?pathogen_test_type=${encodeURIComponent(pathogenTestType)}`
    : path;
}

/** Return a public Serology sample identifier from an API row, if present. */
export function serologyIdFromRow(
  row: Record<string, unknown> | null,
): string | null {
  const sampleIdentifier = row?.sample_identifier;
  return typeof sampleIdentifier === "string" ||
    typeof sampleIdentifier === "number"
    ? String(sampleIdentifier)
    : null;
}

/** Internal Serology member route with an optional scalar discriminator. */
export function serologyHref(
  sampleIdentifier: number | string,
  testType?: string,
): string {
  const path = `/serology/${encodeURIComponent(String(sampleIdentifier))}`;
  return testType ? `${path}?test_type=${encodeURIComponent(testType)}` : path;
}
