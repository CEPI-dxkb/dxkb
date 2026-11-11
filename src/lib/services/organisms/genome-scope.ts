/**
 * A Genome list's query, split by where each clause can run; both parts are
 * already percent-encoded.
 */
export interface GenomeQueryScope {
  fieldRql?: string;
  keywordRql?: string;
}

/**
 * The genomes an organism statistic counts: a taxon's whole lineage less
 * Deprecated genomes, or a Genome list's own query.
 */
export type GenomeScope = number | GenomeQueryScope;

/** Leaves out genomes BV-BRC has superseded, so counts match legacy's. */
export const nonDeprecatedGenomeClause = "ne(genome_status,Deprecated)";

function queryClauses(scope: GenomeQueryScope): string[] {
  return [scope.fieldRql, scope.keywordRql].filter(
    (clause): clause is string => Boolean(clause),
  );
}

export function genomeScopeRql(scope: GenomeScope): string {
  if (typeof scope === "number") {
    return `and(eq(taxon_lineage_ids,${String(scope)}),${nonDeprecatedGenomeClause})`;
  }
  const clauses = queryClauses(scope);
  if (clauses.length === 0) return "eq(genome_id,*)";
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

/**
 * The scope's clauses for a collection linked by `genome_id` (`genome_amr`).
 * Keyword clauses run on the collection itself, because the website API answers
 * a `keyword(...)` inside `genome(...)` on `genome_amr` with HTTP 400.
 */
export function genomeLinkedScopeClauses(scope: GenomeScope): string[] {
  if (typeof scope === "number") return [`genome(${genomeScopeRql(scope)})`];
  return [
    scope.fieldRql && `genome(${scope.fieldRql})`,
    scope.keywordRql,
  ].filter((clause): clause is string => Boolean(clause));
}

export function describeGenomeScope(scope: GenomeScope): string {
  return typeof scope === "number"
    ? `taxonId=${String(scope)}`
    : `genome query ${genomeScopeRql(scope)}`;
}
