import {
  keywordClauses,
  parseRql,
  serializeRql,
  validateRql,
} from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import { DataApiValidationError } from "@/lib/data-api/resources";
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

/**
 * A query built from validated clauses, parsed again; `undefined` when it no
 * longer fits the parser's limits. Each clause passed on its own, but wrapping
 * one in `and(...)` adds a nesting level, and serializing a value can lengthen
 * it (a space becomes `%20`), so the result can be too deep or too long.
 */
function parseValidatedRql(rql: string): RqlExpression | undefined {
  try {
    return parseRql("genome", rql);
  } catch (error) {
    if (error instanceof DataApiValidationError) return undefined;
    throw error;
  }
}

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
 * - `{ supported: false }`: the scope names a genome-only field, or is too
 *   deep or too long to parse.
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
  const expression = parseValidatedRql(rql);
  return expression && namesOnlyTaxonFields(expression)
    ? { supported: true, rql }
    : { supported: false };
}

// The operands of an expression's `and`s, nested ones flattened.
function conjuncts(expression: RqlExpression): RqlExpression[] {
  return expression.operator === "and"
    ? expression.operands.flatMap(conjuncts)
    : [expression];
}

function namesOnlyKeywords(expression: RqlExpression): boolean {
  switch (expression.operator) {
    case "keyword":
      return true;
    case "and":
    case "or":
      return expression.operands.every(namesOnlyKeywords);
    case "not":
      return namesOnlyKeywords(expression.operand);
    default:
      return false;
  }
}

/**
 * An explicit `rql` split into its genome-field and keyword clauses. Only its
 * top-level conjuncts move, so the two parts ANDed back together match the same
 * genomes; a conjunct that mixes keywords with genome fields under `or` or
 * `not` cannot be split without changing that, so it stays a field clause.
 */
function splitRqlKeywords(expression: RqlExpression): {
  fields: string[];
  keywords: string[];
} {
  const serialize = (part: RqlExpression) => serializeRql("genome", part);
  const parts = conjuncts(expression);
  const keywordParts = parts.filter(namesOnlyKeywords);
  if (keywordParts.length === 0)
    return { fields: [serialize(expression)], keywords: [] };
  return {
    fields: parts
      .filter((part) => !namesOnlyKeywords(part))
      .map(serialize),
    keywords: keywordParts.map(serialize),
  };
}

// Kleene's three-valued logic, `undefined` being unknown.
type Truth = boolean | undefined;
const kleeneNot = (value: Truth): Truth =>
  value === undefined ? undefined : !value;
const kleeneAnd = (left: Truth, right: Truth): Truth =>
  left === false || right === false ? false : left && right;
const kleeneOr = (left: Truth, right: Truth): Truth =>
  kleeneNot(kleeneAnd(kleeneNot(left), kleeneNot(right)));

/**
 * How an expression can turn out for a private genome, over the values its
 * other clauses can take: whether it matches, and what it would be with its
 * `public` clauses unknown. An outcome still unknown without them is one they
 * decide. Clauses on other fields are taken as independent of each other, so a
 * contradiction between two of them can add an outcome no genome has, which
 * errs toward a private reading. At most four outcomes are distinct.
 */
type PrivateOutcome = readonly [matches: boolean, withoutPublic: Truth];

// A clause on any field but `public`, which may or may not match either way.
const otherFieldOutcomes: readonly PrivateOutcome[] = [
  [true, true],
  [false, false],
];

function privateOutcomes(
  expression: RqlExpression,
): readonly PrivateOutcome[] {
  switch (expression.operator) {
    case "keyword":
    case "genome":
      return otherFieldOutcomes;
    case "not":
      return privateOutcomes(expression.operand).map(
        ([matches, withoutPublic]) => [!matches, kleeneNot(withoutPublic)],
      );
    case "and":
    case "or": {
      const both = expression.operator === "and";
      return expression.operands.map(privateOutcomes).reduce((left, right) => {
        const outcomes = new Map<string, PrivateOutcome>();
        for (const [leftMatches, leftWithout] of left) {
          for (const [rightMatches, rightWithout] of right) {
            const outcome: PrivateOutcome = both
              ? [leftMatches && rightMatches, kleeneAnd(leftWithout, rightWithout)]
              : [leftMatches || rightMatches, kleeneOr(leftWithout, rightWithout)];
            outcomes.set(String(outcome), outcome);
          }
        }
        return [...outcomes.values()];
      });
    }
    case "in":
      return expression.field === "public"
        ? [[expression.values.includes(false), undefined]]
        : otherFieldOutcomes;
    default: {
      if (expression.field !== "public") return otherFieldOutcomes;
      const matches =
        expression.operator === "eq"
          ? expression.value === false || expression.value === "*"
          : expression.operator === "ne" && expression.value === true;
      return [[matches, undefined]];
    }
  }
}

/**
 * Whether an explicit `rql` asks for private genomes (`public=false`), as the
 * My Genomes filter does: whether the whole expression can match one because
 * of what it says about `public`. `eq(public,*)` and `in(public,(true,false))`
 * count, as the filter's `public=true&public=false` does;
 * `and(eq(public,true),in(public,(true,false)))` does not, and neither does
 * `or(eq(public,true),eq(genome_status,Complete))`, which reaches private
 * genomes only through `genome_status`, as a list with no visibility clause
 * reaches them.
 */
function selectsPrivateGenomes(expression: RqlExpression): boolean {
  return privateOutcomes(expression).some(
    ([matches, withoutPublic]) => matches && withoutPublic === undefined,
  );
}

/**
 * The genomes the Overview tab summarizes: those the Genomes tab lists, so its
 * keyword and refinement clauses (including those of an explicit `rql`) and its
 * genome-field clauses (friendly filters, `rql`, or the recent-genomes default
 * of the bare list), kept apart for the collections that join to genomes
 * (`genomeLinkedScopeClauses`). `undefined` for a list that includes private
 * genomes (My Genomes, `public=false`, or an `rql` that asks for them, which
 * replaces that filter): the overview's requests are public reads, so its
 * charts would be empty for exactly the genomes the list shows. An `rql` too
 * long to parse again stays one genome-field clause, unchecked.
 */
export function genomeOverviewScope(
  state: CollectionState,
): GenomeQueryScope | undefined {
  if (
    Object.hasOwn(state.filters, "public") &&
    state.filters.public.includes("false")
  )
    return undefined;
  const expression = state.rql ? parseValidatedRql(state.rql) : undefined;
  if (expression && selectsPrivateGenomes(expression)) return undefined;
  const explicit = expression
    ? splitRqlKeywords(expression)
    : { fields: [state.rql], keywords: [] };
  const keywords = [
    ...keywordClauses(state.keyword ?? "", "exact"),
    ...keywordClauses(state.refine ?? "", "exact"),
    ...explicit.keywords,
  ];
  const fields = [
    genomeBaseRql(state),
    genomeStructuralRql(state),
    ...explicit.fields,
  ].filter((clause): clause is string => Boolean(clause));
  return {
    ...(fields.length > 0 && { fieldRql: rqlAnd(...fields) }),
    ...(keywords.length > 0 && { keywordRql: rqlAnd(...keywords) }),
  };
}
