/**
 * A Genome list's query, split by where each clause can run. Both parts arrive
 * serialized (`validateRql`, `keywordClauses`), so their values are already
 * percent-encoded and they can sit in a request URL or body as they are.
 */
export interface GenomeQueryScope {
  /** Clauses on genome fields: friendly filters, `rql`, the recent default. */
  fieldRql?: string;
  /** The keyword and refinement clauses, `keyword(...)` alone. */
  keywordRql?: string;
}

/**
 * The genomes an organism statistic counts. A taxon ID scopes a Taxonomy or
 * organism page to the taxon's whole lineage, less its Deprecated genomes; a
 * `GenomeQueryScope` scopes the Genome list's Overview to the list's own query.
 */
export type GenomeScope = number | GenomeQueryScope;

/**
 * Leaves out genomes BV-BRC has superseded. Legacy's Taxonomy view (and the
 * Bacteria and Viruses views built on it) adds it to every query it scopes to
 * a taxon, so its "(N Genomes)" header and Genomes tab never count them.
 */
export const nonDeprecatedGenomeClause = "ne(genome_status,Deprecated)";

function queryClauses(scope: GenomeQueryScope): string[] {
  return [scope.fieldRql, scope.keywordRql].filter(
    (clause): clause is string => Boolean(clause),
  );
}

/** The genome-core predicate that selects the scope's genomes. */
export function genomeScopeRql(scope: GenomeScope): string {
  if (typeof scope === "number") {
    return `and(eq(taxon_lineage_ids,${String(scope)}),${nonDeprecatedGenomeClause})`;
  }
  const clauses = queryClauses(scope);
  if (clauses.length === 0) return "eq(genome_id,*)";
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

/**
 * The scope's clauses for a collection linked to its genomes by `genome_id`
 * (`genome_amr`), each joined to the query with `&`. Genome-field clauses join
 * through `genome(...)`; keyword clauses run on the linked collection itself,
 * as legacy GenomeListOverview hands its query to the AMR core, because the
 * website API answers a `keyword(...)` inside `genome(...)` on `genome_amr` with
 * HTTP 400 ("no field name specified in query and no default specified via 'df'
 * param").
 */
export function genomeLinkedScopeClauses(scope: GenomeScope): string[] {
  if (typeof scope === "number") return [`genome(${genomeScopeRql(scope)})`];
  return [
    scope.fieldRql && `genome(${scope.fieldRql})`,
    scope.keywordRql,
  ].filter((clause): clause is string => Boolean(clause));
}

/** The scope as server logs name it. */
export function describeGenomeScope(scope: GenomeScope): string {
  return typeof scope === "number"
    ? `taxonId=${String(scope)}`
    : `genome query ${genomeScopeRql(scope)}`;
}
