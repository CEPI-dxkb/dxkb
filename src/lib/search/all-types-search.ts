// The all-data-types search (`/search?type=everything&q=…`): one Data API
// request for every DXKB type's match count and top rows, and the rows turned
// into what the result tables show.

import { queryOptions } from "@tanstack/react-query";

import { allTermSearchTypes, searchHref } from "@/constants/search-info";
import { DataRepositoryError } from "@/lib/data-api/client";
import { isTaxonId } from "@/lib/taxonomy-view";
import {
  epitopeHref,
  epitopeIdFromRow,
  experimentHref,
  experimentIdFromRow,
  featureHref,
  featureIdFromRow,
  genomeHref,
  genomeIdFromRow,
  proteinStructureHref,
  serologyHref,
  serologyIdFromRow,
  strainHref,
  strainIdFromRow,
  surveillanceHref,
  surveillanceIdFromRow,
  taxonomyHref,
} from "@/lib/views/hrefs";
import { isSearchableKeyword } from "./all-types-query";

export {
  expandedRowCount,
  previewRowCount,
  typeSearchQuery,
} from "./all-types-query";

/**
 * The same-origin route that runs the search (`src/app/api/data/search`), so
 * it gets the server's upstream budget, failure mapping and the user's token
 * rather than a browser connection straight to the Data API.
 */
export const allTypesSearchPath = "/api/data/search";

export type SearchDoc = Record<string, unknown>;

/**
 * Unvalidated JSON, so every level can be missing: one malformed type must
 * not take the other types' results down with it.
 */
interface SolrResponse {
  result?: { response?: { docs?: SearchDoc[]; numFound: number } };
}

/** The Data API's answer, keyed by type. A type it could not search is absent. */
export type TypeMatches = Partial<Record<string, SolrResponse>>;

/** The route's `{error, code}` answer as a `DataRepositoryError`, its message kept. */
async function searchResponseError(
  response: Response,
): Promise<DataRepositoryError> {
  const payload: unknown = await response.json().catch(() => null);
  const body =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown; code?: unknown })
      : {};
  return new DataRepositoryError(
    typeof body.error === "string" && body.error.trim()
      ? body.error
      : `Search request failed with status ${String(response.status)}.`,
    response.status,
    typeof body.code === "string" ? body.code : "request_failed",
  );
}

/**
 * Every DXKB type's top matches for `keyword`, in one request through the
 * search route. A failure keeps the route's own message (which names the
 * upstream cause: "The BV-BRC data service … did not respond …"); a request
 * that never reached the route says so rather than a bare "Failed to fetch".
 */
export async function fetchTypeMatches(
  keyword: string,
  signal?: AbortSignal,
): Promise<TypeMatches> {
  let response: Response;
  try {
    response = await fetch(allTypesSearchPath, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keyword }),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not reach the DXKB search service${reason ? ` (${reason})` : ""}. Check your connection and try again.`,
      { cause: error },
    );
  }
  if (!response.ok) throw await searchResponseError(response);
  return (await response.json()) as TypeMatches;
}

export interface RowFact {
  label: string;
  value: string;
}

/** One result row, as every type's table shows it. */
export interface ResultRow {
  key: string;
  title: string;
  /** Sequences read better in mono. */
  monoTitle: boolean;
  /** The row's context column (see `TypeResults.contextLabel`). */
  context: string;
  facts: RowFact[];
  id: string;
  href: string | null;
}

/** One DXKB type's matches. */
export interface TypeResults {
  id: string;
  label: string;
  count: number;
  /** The type's own list, searched for the same keyword. */
  listHref: string;
  /** The heading of the rows' context column. */
  contextLabel: string;
  rows: ResultRow[];
}

/** The top Taxa match, which the page header leads with. */
export interface TaxonMatch {
  name: string;
  taxonId: string;
  href: string | null;
  genomes: number;
  rank: string;
  /** The two ranks above it, nearest last. */
  parents: string[];
}

export interface AllTypesResults {
  types: TypeResults[];
  total: number;
  bestMatch: TaxonMatch | null;
}

const contextLabelByType: Readonly<Record<string, string>> = {
  taxonomy: "Lineage",
  genome: "Origin",
  strain: "Species · Host",
  genome_feature: "Genome",
  protein_feature: "Product · Genome",
  epitope: "Protein · Organism",
  protein_structure: "Organism",
  surveillance: "Institution",
  serology: "Host · Country · Year",
  experiment: "Description",
};

function text(value: unknown): string {
  if (Array.isArray(value))
    return value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map(String)
      .filter(Boolean)
      .join(", ");
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function first(value: unknown): string {
  return Array.isArray(value) ? text(value[0]) : text(value);
}

function year(value: unknown): string {
  return first(value).slice(0, 4);
}

function join(parts: string[], separator = " · "): string {
  return parts.filter(Boolean).join(separator);
}

function facts(entries: [string, string][]): RowFact[] {
  return entries
    .filter(([, value]) => value !== "")
    .map(([label, value]) => ({ label, value }));
}

const countFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(count: number): string {
  return countFormat.format(count);
}

/** "2.2M": a count where space is short (the Data types rail). */
export function formatCompact(count: number): string {
  return compactFormat.format(count);
}

function counted(value: unknown, noun: string): string {
  const raw = text(value);
  if (!raw) return "";
  return `${formatCount(Number(raw))} ${noun}${raw === "1" ? "" : "s"}`;
}

function measured(value: unknown, unit: string): string {
  const raw = text(value);
  return raw ? `${formatCount(Number(raw))} ${unit}` : "";
}

function lineageNames(doc: SearchDoc): string[] {
  return Array.isArray(doc.lineage_names)
    ? doc.lineage_names
        .map(String)
        .filter((name) => name !== "cellular organisms")
    : [];
}

function describe(id: string, doc: SearchDoc, index: number): ResultRow {
  const base = { key: `${id}-${String(index)}`, monoTitle: false };
  switch (id) {
    case "taxonomy": {
      const taxonId = text(doc.taxon_id);
      return {
        ...base,
        key: taxonId || base.key,
        title: text(doc.taxon_name),
        // The nearest three ranks between the root and the taxon itself.
        context: lineageNames(doc).slice(1, -1).slice(-3).join(" › "),
        facts: facts([
          ["Rank", text(doc.taxon_rank)],
          ["Genomes", counted(doc.genomes, "genome")],
        ]),
        id: taxonId,
        href: isTaxonId(taxonId) ? taxonomyHref(taxonId) : null,
      };
    }
    case "genome": {
      const genomeId = genomeIdFromRow(doc);
      return {
        ...base,
        key: genomeId ?? base.key,
        title: text(doc.genome_name),
        context: join([
          text(doc.host_name) || text(doc.species),
          text(doc.isolation_country),
          year(doc.collection_year ?? doc.collection_date),
        ]),
        facts: facts([
          ["Subtype", text(doc.subtype) || text(doc.serovar)],
          ["Status", text(doc.genome_status)],
          ["Length", measured(doc.genome_length, "bp")],
          ["Contigs", counted(doc.contigs, "contig")],
        ]),
        id: genomeId ?? "",
        href: genomeId ? genomeHref(genomeId) : null,
      };
    }
    case "strain": {
      // The record ID, not the strain name: legacy links the name as a
      // phrase, which opens every strain sharing that prefix.
      const strainId = strainIdFromRow(doc);
      return {
        ...base,
        key: strainId ?? base.key,
        title: text(doc.strain),
        context: join([text(doc.species), text(doc.host_name)]),
        facts: facts([
          ["Year", text(doc.collection_year)],
          ["Segments", counted(doc.segment_count, "segment")],
          ["Status", text(doc.status)],
        ]),
        id: first(doc.genbank_accessions),
        href: strainId ? strainHref(strainId) : null,
      };
    }
    case "genome_feature": {
      // A Feature doc has no `id`, and the top features can share a genome.
      const featureId = featureIdFromRow(doc);
      return {
        ...base,
        key: featureId ?? base.key,
        title: join(
          [text(doc.product) || text(doc.feature_type), text(doc.gene)],
          " | ",
        ),
        context: text(doc.genome_name),
        facts: facts([
          ["Type", text(doc.feature_type)],
          ["Source", text(doc.annotation)],
          ["Length", measured(doc.na_length, "nt")],
        ]),
        id: text(doc.patric_id) || (featureId ?? ""),
        href: featureId ? featureHref(featureId) : null,
      };
    }
    case "protein_feature": {
      // The feature the domain sits on, as the Domains and Motifs list links.
      const featureId = featureIdFromRow(doc);
      return {
        ...base,
        key: text(doc.id) || base.key,
        title: text(doc.interpro_description) || text(doc.description),
        context: join([text(doc.product), text(doc.genome_name)]),
        facts: facts([
          ["Source", join([text(doc.source), text(doc.source_id)], " ")],
          [
            "Position",
            doc.start != null ? `${text(doc.start)}–${text(doc.end)}` : "",
          ],
          ["E-value", text(doc.e_value)],
        ]),
        id: text(doc.interpro_id) || text(doc.source_id),
        href: featureId ? featureHref(featureId) : null,
      };
    }
    case "epitope": {
      const epitopeId = epitopeIdFromRow(doc);
      return {
        ...base,
        key: epitopeId ?? base.key,
        monoTitle: true,
        title: text(doc.epitope_sequence),
        context: join([text(doc.protein_name), text(doc.organism)]),
        facts: facts([
          ["Type", text(doc.epitope_type)],
          ["Assay", first(doc.assay_results)],
          ["Host", first(doc.host_name)],
        ]),
        id: epitopeId ? `IEDB ${epitopeId}` : "",
        href: epitopeId ? epitopeHref(epitopeId) : null,
      };
    }
    case "protein_structure": {
      // One genome's protein can have many structures; the PDB ID tells them apart.
      const pdbId = text(doc.pdb_id);
      return {
        ...base,
        key: pdbId || base.key,
        title: text(doc.title),
        context: text(doc.organism_name),
        facts: facts([
          ["Method", first(doc.method)],
          [
            "Resolution",
            doc.resolution != null ? `${text(doc.resolution)} Å` : "",
          ],
          ["Released", year(doc.release_date)],
        ]),
        id: pdbId,
        href: pdbId ? proteinStructureHref(pdbId) : null,
      };
    }
    case "surveillance": {
      const sampleId = surveillanceIdFromRow(doc);
      const testTypes = Array.isArray(doc.pathogen_test_type)
        ? doc.pathogen_test_type.filter(
            (value): value is string => typeof value === "string",
          )
        : typeof doc.pathogen_test_type === "string"
          ? [doc.pathogen_test_type]
          : [];
      return {
        ...base,
        key: text(doc.id) || base.key,
        title: join([
          text(doc.host_common_name) || text(doc.host_species),
          text(doc.collection_country),
          year(doc.collection_date),
        ]),
        context:
          text(doc.collector_institution) ||
          text(doc.contributing_institution),
        facts: facts([
          ["Pathogen", text(doc.pathogen_type)],
          ["Test", first(doc.pathogen_test_type)],
          ["Result", first(doc.pathogen_test_result)],
        ]),
        id: sampleId ?? "",
        // A sample tested more than one way is one row per test type; with no
        // single type, the member page asks which.
        href: sampleId
          ? surveillanceHref(
              sampleId,
              testTypes.length === 1 ? testTypes[0] : undefined,
            )
          : null,
      };
    }
    case "serology": {
      const sampleId = serologyIdFromRow(doc);
      const testType = text(doc.test_type);
      return {
        ...base,
        key: text(doc.id) || base.key,
        // Serology records name no strain or pathogen; the sample is the name.
        title: sampleId ?? "",
        context: join([
          text(doc.host_common_name),
          text(doc.collection_country),
          year(doc.collection_date),
        ]),
        facts: facts([
          ["Test", testType],
          ["Result", text(doc.test_result)],
          ["Serotype", first(doc.serotype)],
        ]),
        id: sampleId ?? "",
        href: sampleId ? serologyHref(sampleId, testType || undefined) : null,
      };
    }
    case "experiment": {
      // An Experiment ID can be all digits with a leading zero ("00042").
      const experimentId = experimentIdFromRow(doc);
      return {
        ...base,
        key: experimentId ?? base.key,
        title: text(doc.exp_title) || text(doc.exp_name),
        context: text(doc.exp_description),
        facts: facts([
          ["Technique", text(doc.measurement_technique)],
          ["Biosets", counted(doc.biosets, "bioset")],
          ["Accession", text(doc.public_identifier)],
        ]),
        id: experimentId ?? "",
        href: experimentId ? experimentHref(experimentId) : null,
      };
    }
    default:
      return {
        ...base,
        key: text(doc.id) || base.key,
        title: text(doc.name) || text(doc.id) || "Untitled",
        context: text(doc.description),
        facts: [],
        id: text(doc.id),
        href: null,
      };
  }
}

export function describeRows(id: string, docs: SearchDoc[]): ResultRow[] {
  return docs.map((doc, index) => {
    const row = describe(id, doc, index);
    // A row missing its type's title fields still needs a name to click.
    return row.title ? row : { ...row, title: row.id || "Untitled" };
  });
}

function taxonMatchOf(doc: SearchDoc | undefined): TaxonMatch | null {
  const name = text(doc?.taxon_name);
  if (!doc || !name) return null;
  const taxonId = text(doc.taxon_id);
  const rank = text(doc.taxon_rank);
  return {
    name,
    taxonId,
    href: isTaxonId(taxonId) ? taxonomyHref(taxonId) : null,
    genomes: Number(doc.genomes ?? 0),
    rank: rank.charAt(0).toUpperCase() + rank.slice(1),
    parents: lineageNames(doc).slice(-3, -1),
  };
}

/** Every DXKB type's matches, in DXKB order, zero-count types included. */
export function toAllTypesResults(
  matches: TypeMatches | undefined,
  keyword: string,
): AllTypesResults {
  const types = allTermSearchTypes.map((type): TypeResults => {
    const response = matches?.[type.id]?.result?.response;
    return {
      id: type.id,
      label: type.typeTitle,
      count: response?.numFound ?? 0,
      listHref: searchHref(type, keyword),
      contextLabel: contextLabelByType[type.id] ?? "Context",
      rows: describeRows(type.id, response?.docs ?? []),
    };
  });
  return {
    types,
    total: types.reduce((sum, type) => sum + type.count, 0),
    bestMatch: taxonMatchOf(
      matches?.taxonomy?.result?.response?.docs?.at(0),
    ),
  };
}

const allTypesSearchKeys = {
  all: ["all-types-search"] as const,
  overview: (keyword: string) =>
    [...allTypesSearchKeys.all, "overview", keyword] as const,
};

/** Every type's count and top rows for `keyword` (normalized text). */
export function allTypesSearchQueryOptions(keyword: string) {
  return queryOptions({
    queryKey: allTypesSearchKeys.overview(keyword),
    queryFn: ({ signal }) => fetchTypeMatches(keyword, signal),
    // Text without terms (blank, `""`, a lone `OR`, only syntax) is no search:
    // it would build an empty and(), which the Data API rejects.
    enabled: isSearchableKeyword(keyword),
    retry: false,
  });
}
