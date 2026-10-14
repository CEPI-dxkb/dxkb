import { keywordClauses, parseRql, validateRql } from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import type { RqlExpression } from "@/lib/data-api/rql";
import type { GenomeQueryScope } from "@/lib/services/organisms/genome-scope";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { rqlAnd, type SearchParamsRecord } from "@/lib/views/rql";
import {
  structuralFilterRql,
  taxonLineageFieldMap,
} from "@/lib/views/structural-rql";

import { genomeMetadata } from "./fields";

export const genomeSorts = genomeMetadata.sorts;

export const recentGenomeRql =
  "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))";

/**
 * The recent-genomes default applies only to an otherwise unscoped list. An
 * explicit RQL query replaces it, and so does a `public` visibility filter:
 * "My Genomes" (`public=false`) must list every private genome, not just the
 * ones completed in the last year. A keyword search replaces it too, as legacy
 * BV-BRC's does (`keyword(...)` alone), so a search lists every genome it
 * matches; and so does a refinement, so the Genomes tab and the related tabs
 * (which run the refinement on their own collections, `genomeRelatedScope`)
 * cover the same records.
 */
export function genomeBaseRql(state: CollectionState): string | undefined {
  // Text without terms (blank, `"`, only syntax) searches for nothing.
  return state.rql ||
    keywordQuery(state.keyword ?? "").length > 0 ||
    keywordQuery(state.refine ?? "").length > 0 ||
    Object.hasOwn(state.filters, "public")
    ? undefined
    : recentGenomeRql;
}

export const genomeCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...genomeSorts],
  friendlyFilters: [
    "taxon_id",
    "genome_status",
    "genome_quality",
    "collection_year",
    "isolation_country",
    "host_common_name",
    // Visibility scope behind the "My Genomes" link. A friendly filter rather
    // than `rql` so selecting a facet adds to it instead of replacing it.
    "public",
  ],
  // `public` is a boolean field; the gateway rejects any other value.
  filterValues: { public: ["true", "false"] },
};

export function parseGenomeCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, genomeCollectionOptions);
  if (state.rql) state.rql = validateRql("genome", state.rql);
  return state;
}

// Derived from `friendlyFilters` so the two lists agree by construction: each
// friendly filter name maps to itself, except the shared taxonomic-lineage
// remap. Restating the names here instead would let the lists drift.
//
// Genome pairs this with `unknownFilters: "drop"` (every other
// structural-filter module passes unmapped names through unchanged). Note what
// that does and does not buy, because deriving the table changed it: since
// `parseCollectionState` only admits names in `friendlyFilters`, and every
// admitted name is a key here by construction, "drop" is unreachable for
// URL-derived state. It still guards a caller that hands `structuralFilterRql`
// a hand-built `CollectionState`. A new friendly filter therefore reaches the
// backend under its raw name automatically — which is the intended behaviour
// for a field whose Solr name matches, but it is NOT a tripwire forcing this
// table to be updated first. Add the entry when the Solr name differs.
const genomeStructuralFieldMap: Readonly<Record<string, string>> =
  Object.fromEntries(
    (genomeCollectionOptions.friendlyFilters ?? []).map((name) => [
      name,
      taxonLineageFieldMap[name] ?? name,
    ]),
  );

export function genomeStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("genome", state, {
    fieldMap: genomeStructuralFieldMap,
    unknownFilters: "drop",
  });
}

/**
 * How the Genome list's related tabs (Strains, Sequences, Features, Proteins,
 * Protein Structures, Domains and Motifs) scope their rows. Legacy BV-BRC's
 * GenomeList hands its own query verbatim to each tab's collection, and DXKB
 * does the same wherever that works:
 * - `undefined`: an unscoped list, so each tab lists its whole collection;
 * - `{ rql, join: false }`: keyword and refinement only; `rql` is those
 *   `keyword(...)` clauses, run on the tab's own collection. They are built
 *   as the Genomes tab builds its own: one exact clause per term
 *   (`keywordClauses`, what its `?keyword=` sends and what
 *   `ResourceCollection`'s refinement, `rqlKeyword`, sends);
 * - `{ rql, join: true }`: friendly filters, `public` or explicit `rql`. They
 *   name genome fields, which legacy's pass-through sends to the child
 *   collection and gets HTTP 400 for, so the tabs join to the listed genomes
 *   with `genome(<rql>)` (Strains: `genome(to(genome_ids),<rql>)`), `rql`
 *   being the Genomes tab's effective query.
 *
 * Epitopes, Surveillance and Serology have no genome ID to join on; they scope
 * through `genomeTaxonScope` instead.
 */
export function genomeRelatedScope(
  state: CollectionState,
): { rql: string; join: boolean } | undefined {
  const keywords = [
    // Exact, as the Genomes tab's `serverKeywordMode` (genome-collection.tsx).
    ...keywordClauses(state.keyword ?? "", "exact"),
    ...keywordClauses(state.refine ?? "", "exact"),
  ];
  const structural = genomeStructuralRql(state);
  if (!structural && !state.rql) {
    return keywords.length > 0
      ? { rql: rqlAnd(...keywords), join: false }
      : undefined;
  }
  const clauses = [
    genomeBaseRql(state),
    structural,
    ...keywords,
    state.rql,
  ].filter((clause): clause is string => Boolean(clause));
  return { rql: rqlAnd(...clauses), join: true };
}

export type GenomeTaxonScope =
  | { supported: true; rql?: string }
  | { supported: false };

// The one genome field Epitope, Surveillance and Serology records share with it.
const taxonScopeFields: ReadonlySet<string> = new Set(["taxon_lineage_ids"]);

function namesOnlyTaxonFields(expression: RqlExpression): boolean {
  switch (expression.operator) {
    case "keyword":
      return true;
    case "and":
    case "or":
      return expression.operands.every(namesOnlyTaxonFields);
    case "not":
      return namesOnlyTaxonFields(expression.operand);
    case "genome":
      return false;
    default:
      return taxonScopeFields.has(expression.field);
  }
}

/**
 * How the Genome list's Epitopes, Surveillance and Serology tabs scope their
 * rows. Those records carry no genome ID, so the Data API cannot join them to
 * the listed genomes (`genome(...)` is an HTTP 400 on all three); what they share
 * with a genome is its taxonomy. A scope that names nothing but keywords and
 * `taxon_lineage_ids` (the Taxon friendly filter, or an `rql` such as the
 * Taxonomy page's genome links) therefore runs on the tab's own collection, as
 * legacy GenomeList hands each tab its query. Any other genome field (a status,
 * a visibility, a genome ID list) has no counterpart there, so the tab is
 * unsupported rather than silently broader than the Genomes tab. The
 * recent-genomes default (`genomeBaseRql`) is a Genomes-tab listing default, not
 * carried, as the related tabs of the bare list do not carry it.
 * - `{ supported: true }`: unscoped, so the tab lists its whole collection;
 * - `{ supported: true, rql }`: keyword and taxon clauses, in the order
 *   `genomeRelatedScope` builds them;
 * - `{ supported: false }`: the scope names a genome-only field.
 */
export function genomeTaxonScope(state: CollectionState): GenomeTaxonScope {
  const clauses = [
    genomeStructuralRql(state),
    ...keywordClauses(state.keyword ?? "", "exact"),
    ...keywordClauses(state.refine ?? "", "exact"),
    state.rql,
  ].filter((clause): clause is string => Boolean(clause));
  if (clauses.length === 0) return { supported: true };
  const rql = rqlAnd(...clauses);
  return namesOnlyTaxonFields(parseRql("genome", rql))
    ? { supported: true, rql }
    : { supported: false };
}

/**
 * The genomes the Overview tab summarizes: those the Genomes tab lists, so its
 * keyword and refinement clauses and its genome-field clauses (friendly filters,
 * `rql`, or the recent-genomes default of the bare list), kept apart for the
 * collections that join to genomes (`genomeLinkedScopeClauses`). `undefined`
 * for a list that includes private genomes (My Genomes, `public=false`): the
 * overview's requests are public reads, so its charts would be empty for
 * exactly the genomes the list shows.
 */
export function genomeOverviewScope(
  state: CollectionState,
): GenomeQueryScope | undefined {
  if (
    Object.hasOwn(state.filters, "public") &&
    state.filters.public.includes("false")
  )
    return undefined;
  const keywords = [
    ...keywordClauses(state.keyword ?? "", "exact"),
    ...keywordClauses(state.refine ?? "", "exact"),
  ];
  const fields = [
    genomeBaseRql(state),
    genomeStructuralRql(state),
    state.rql,
  ].filter((clause): clause is string => Boolean(clause));
  return {
    ...(fields.length > 0 && { fieldRql: rqlAnd(...fields) }),
    ...(keywords.length > 0 && { keywordRql: rqlAnd(...keywords) }),
  };
}
