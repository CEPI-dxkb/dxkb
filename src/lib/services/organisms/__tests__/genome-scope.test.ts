import {
  genomeLinkedScopeClauses,
  genomeScopeRql,
  nonDeprecatedGenomeClause,
} from "@/lib/services/organisms/genome-scope";

describe("genomeLinkedScopeClauses", () => {
  it("does not join on a bare Deprecated exclusion, which matches no genome across collections", () => {
    expect(
      genomeLinkedScopeClauses({
        fieldRql: nonDeprecatedGenomeClause,
        keywordRql: "keyword(coli)",
      }),
    ).toEqual(["keyword(coli)"]);
    expect(
      genomeLinkedScopeClauses({ fieldRql: nonDeprecatedGenomeClause }),
    ).toEqual([]);
  });

  it("still joins when a positive clause sits beside the exclusion", () => {
    const fieldRql = `and(${nonDeprecatedGenomeClause},eq(family,Enterobacteriaceae))`;
    expect(
      genomeLinkedScopeClauses({ fieldRql, keywordRql: "keyword(coli)" }),
    ).toEqual([`genome(${fieldRql})`, "keyword(coli)"]);
  });

  it("still joins on any other field clause", () => {
    expect(
      genomeLinkedScopeClauses({ fieldRql: "eq(genome_status,Complete)" }),
    ).toEqual(["genome(eq(genome_status,Complete))"]);
  });

  it("keeps the taxon scope join unchanged", () => {
    expect(genomeLinkedScopeClauses(562)).toEqual([
      `genome(${genomeScopeRql(562)})`,
    ]);
  });
});
