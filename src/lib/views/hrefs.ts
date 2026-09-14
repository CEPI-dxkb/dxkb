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

/** Canonical Feature list route. Explicit RQL takes precedence over keyword. */
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

/** Canonical Epitope collection route. Explicit RQL takes precedence over keyword. */
export function epitopeListHref(opts?: {
  keyword?: string;
  rql?: string;
  taxonId?: number | string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else if (opts?.keyword)
    params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
  if (opts?.taxonId != null) {
    params.push(`taxon_id=${encodeURIComponent(String(opts.taxonId))}`);
  }
  return params.length ? `/epitope?${params.join("&")}` : "/epitope";
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

/** Canonical Experiment collection route. Explicit RQL takes precedence. */
export function experimentListHref(opts?: {
  keyword?: string;
  rql?: string;
  taxonId?: number | string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else {
    if (opts?.keyword)
      params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
    if (opts?.taxonId != null)
      params.push(`taxon_id=${encodeURIComponent(String(opts.taxonId))}`);
  }
  return params.length ? `/experiment?${params.join("&")}` : "/experiment";
}

/** Internal Protein Structure route using the canonical accession query. */
export function proteinStructureHref(accession: number | string): string {
  return `/protein-structure?accession=${encodeURIComponent(String(accession))}`;
}

/** Canonical Protein Structure collection route. Explicit RQL takes precedence. */
export function proteinStructureListHref(opts?: {
  keyword?: string;
  rql?: string;
  taxonId?: number | string;
  genomeId?: number | string;
  page?: number;
  sort?: string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else {
    if (opts?.keyword)
      params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
    if (opts?.taxonId != null)
      params.push(`taxon_id=${encodeURIComponent(String(opts.taxonId))}`);
    if (opts?.genomeId != null)
      params.push(`genome_id=${encodeURIComponent(String(opts.genomeId))}`);
  }
  if (opts?.page != null)
    params.push(`page=${encodeURIComponent(String(opts.page))}`);
  if (opts?.sort) params.push(`sort=${encodeURIComponent(opts.sort)}`);
  return params.length
    ? `/protein-structure?${params.join("&")}`
    : "/protein-structure";
}

/** Protein Structure route for a workspace file. */
export function proteinStructurePathHref(path: string): string {
  return `/protein-structure?path=${encodeURIComponent(path)}`;
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

/** Canonical Surveillance collection route. Explicit RQL takes precedence over keyword. */
export function surveillanceListHref(opts?: {
  keyword?: string;
  rql?: string;
  pathogenTestType?: string | readonly string[];
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else if (opts?.keyword)
    params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
  const discriminator = opts?.pathogenTestType;
  const testTypes: readonly string[] = Array.isArray(discriminator)
    ? discriminator
    : typeof discriminator === "string"
      ? [discriminator]
      : [];
  for (const testType of testTypes) {
    params.push(`pathogen_test_type=${encodeURIComponent(testType)}`);
  }
  return params.length ? `/surveillance?${params.join("&")}` : "/surveillance";
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

/** Canonical Strain collection route. Explicit RQL takes precedence over keyword. */
export function strainListHref(opts?: {
  keyword?: string;
  rql?: string;
  taxonId?: number | string;
  strain?: string | readonly string[];
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else if (opts?.keyword)
    params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
  if (!opts?.rql) {
    if (opts?.taxonId != null) {
      params.push(`taxon_id=${encodeURIComponent(String(opts.taxonId))}`);
    }
    const strain = opts?.strain;
    const values: readonly string[] = Array.isArray(strain)
      ? strain
      : typeof strain === "string"
        ? [strain]
        : [];
    for (const value of values)
      params.push(`strain=${encodeURIComponent(value)}`);
  }
  return params.length ? `/strain?${params.join("&")}` : "/strain";
}

/** Canonical Domains and Motifs collection route. */
export function domainsAndMotifsListHref(opts?: {
  keyword?: string;
  rql?: string;
  genomeId?: number | string;
  featureId?: number | string;
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else {
    if (opts?.keyword)
      params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
    if (opts?.genomeId != null)
      params.push(`genome_id=${encodeURIComponent(String(opts.genomeId))}`);
    if (opts?.featureId != null)
      params.push(`feature_id=${encodeURIComponent(String(opts.featureId))}`);
  }
  return params.length
    ? `/domains-and-motifs?${params.join("&")}`
    : "/domains-and-motifs";
}

/** Canonical Serology collection route. Explicit RQL takes precedence over keyword. */
export function serologyListHref(opts?: {
  keyword?: string;
  rql?: string;
  testType?: string | readonly string[];
}): string {
  const params: string[] = [];
  if (opts?.rql) params.push(`rql=${encodeURIComponent(opts.rql)}`);
  else if (opts?.keyword)
    params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
  const discriminator = opts?.testType;
  const testTypes: readonly string[] = Array.isArray(discriminator)
    ? discriminator
    : typeof discriminator === "string"
      ? [discriminator]
      : [];
  for (const testType of testTypes) {
    params.push(`test_type=${encodeURIComponent(testType)}`);
  }
  return params.length ? `/serology?${params.join("&")}` : "/serology";
}
