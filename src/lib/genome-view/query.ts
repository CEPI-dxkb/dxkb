import {
  booleanFilterValues,
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

/** The recent-genomes default applies only to an otherwise unscoped list: an explicit RQL, `public` filter, keyword search or refinement replaces it. */
export function genomeBaseRql(state: CollectionState): string | undefined {
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
    ...new Set([
      "taxon_id",
      "genome_status",
      "genome_quality",
      "collection_year",
      "isolation_country",
      "host_common_name",
      "host_name",
      "host_group",
      "isolation_source",
      "sequencing_centers",
      "family",
      "genus",
      "species",
      "reference_genome",
      // A friendly filter rather than `rql`, so selecting a facet adds to it instead of replacing it.
      "public",
      // A facet missing here is dropped when its pick is written to the URL.
      ...genomeMetadata.facetFields,
    ]),
  ],
  // `public` is a boolean field; the gateway rejects any other value.
  filterValues: booleanFilterValues(["public"]),
};

export function parseGenomeCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, genomeCollectionOptions);
  if (state.rql) state.rql = validateRql("genome", state.rql);
  return state;
}

// Derived from `friendlyFilters` so the lists agree by construction.
// `unknownFilters: "drop"` only guards a hand-built `CollectionState`; a new friendly filter reaches the backend under its raw name, so add an entry here when the Solr name differs.
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
 * How the Genome list's related tabs scope their rows: `undefined` is unscoped, `{ rql, join: false }` runs keyword and refinement clauses on the tab's own collection, and `{ rql, join: true }` joins to the listed genomes with `genome(<rql>)` (Strains: `genome(to(genome_ids),<rql>)`) because genome fields are an HTTP 400 on child collections.
 * Epitopes, Surveillance and Serology scope through `genomeTaxonScope` instead.
 */
export function genomeRelatedScope(
  state: CollectionState,
): { rql: string; join: boolean } | undefined {
  const keywords = [
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

/** Re-parses the query; `undefined` when wrapping in `and(...)` or serializing (a space becomes `%20`) pushes it past the parser's limits. */
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
 * How Epitopes, Surveillance and Serology scope their rows: they carry no genome ID (`genome(...)` is an HTTP 400), so only keyword and `taxon_lineage_ids` clauses carry over.
 * `supported: false` means the scope names a genome-only field or is too deep or long to parse.
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

/** An explicit `rql` split into genome-field and keyword clauses; only top-level conjuncts move, so a conjunct mixing both under `or`/`not` stays a field clause. */
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

/** Possible outcomes of an expression for a private genome, with its `public` clauses unknown. Clauses on other fields are treated as independent, which errs toward a private reading. */
type PrivateOutcome = readonly [matches: boolean, withoutPublic: Truth];

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

/** Whether an explicit `rql` asks for private genomes (`public=false`) by what it says about `public`: `eq(public,*)` counts, `and(eq(public,true),in(public,(true,false)))` does not. */
function selectsPrivateGenomes(expression: RqlExpression): boolean {
  return privateOutcomes(expression).some(
    ([matches, withoutPublic]) => matches && withoutPublic === undefined,
  );
}

/** The genomes the Overview tab summarizes: those the Genomes tab lists. `undefined` when the list includes private genomes, since the overview's requests are public reads. */
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
