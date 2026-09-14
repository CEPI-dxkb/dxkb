import { parseRql, validateRql } from "@/lib/data-api";
import type { RqlExpression } from "@/lib/data-api/rql";
import {
  featureInteractionsRql,
  genomeInteractionsRql,
  taxonomyInteractionsRql,
} from "../child-resources";

/**
 * A PPI row files its two interactors as an A side and a B side, and nothing in
 * the record says which one carries the scoped organism: the two sides have
 * identical field shapes, `toGraph` classifies each independently as host or
 * microbial, and the Feature predicate has always matched either endpoint. So a
 * scoped feature — and therefore the genome it belongs to — can sit on either
 * side, and an A-only predicate silently drops every B-side row.
 *
 * These cases evaluate the parsed predicate against rows on each side. Only the
 * `and`/`or`/`eq`/`ne` subset the interaction predicates use is interpreted;
 * anything else is a deliberate failure rather than a silent pass.
 */
type PpiRow = Record<string, string | undefined>;

function matches(expression: RqlExpression, row: PpiRow): boolean {
  if (expression.operator === "and")
    return expression.operands.every((operand) => matches(operand, row));
  if (expression.operator === "or")
    return expression.operands.some((operand) => matches(operand, row));
  if (expression.operator === "eq")
    return expression.value === "*"
      ? row[expression.field] !== undefined
      : row[expression.field] === expression.value;
  if (expression.operator === "ne")
    return row[expression.field] !== expression.value;
  throw new Error(`Unevaluated RQL operator: ${expression.operator}`);
}

function matcher(rql: string) {
  const expression = parseRql("ppi", rql);
  return (row: PpiRow) => matches(expression, row);
}

const experimental = { evidence: "experimental" };

describe("interaction scoping predicates", () => {
  it("matches a Genome on either interaction endpoint", () => {
    const scoped = matcher(genomeInteractionsRql("83332.12"));

    expect(
      scoped({ ...experimental, genome_id_a: "83332.12", genome_id_b: "1.1" }),
    ).toBe(true);
    // The B-only row: the scoped genome appears solely as interactor B. The
    // previous `eq(genome_id_a,…)` predicate dropped it.
    expect(
      scoped({ ...experimental, genome_id_a: "1.1", genome_id_b: "83332.12" }),
    ).toBe(true);
    expect(
      scoped({ ...experimental, genome_id_a: "1.1", genome_id_b: "2.2" }),
    ).toBe(false);
  });

  it("still requires experimental evidence for a B-side Genome match", () => {
    const scoped = matcher(genomeInteractionsRql("83332.12"));

    expect(
      scoped({
        evidence: "predicted",
        genome_id_a: "1.1",
        genome_id_b: "83332.12",
      }),
    ).toBe(false);
  });

  it("matches a Feature on either interaction endpoint", () => {
    const scoped = matcher(featureInteractionsRql("PATRIC.1"));

    expect(
      scoped({
        ...experimental,
        feature_id_a: "PATRIC.1",
        feature_id_b: "PATRIC.2",
      }),
    ).toBe(true);
    expect(
      scoped({
        ...experimental,
        feature_id_a: "PATRIC.2",
        feature_id_b: "PATRIC.1",
      }),
    ).toBe(true);
    expect(
      scoped({
        ...experimental,
        feature_id_a: "PATRIC.2",
        feature_id_b: "PATRIC.3",
      }),
    ).toBe(false);
  });

  it("keeps Taxonomy scoping on the only Genome join the data contract accepts", () => {
    // Taxonomy resolves a lineage through the Genome relationship join, and the
    // contract accepts `to(genome_id_a)` alone for ppi — see the PPI Genome
    // relationship case in src/lib/data-api/__tests__/rql.test.ts. This
    // predicate is therefore A-side only, and symmetry here needs a contract
    // change rather than a wider predicate.
    const rql = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");

    // Contract-valid (the gateway re-encodes the `*` wildcard, so this is not a
    // byte-identical round trip) and A-side by necessity, not by assumption.
    expect(() => validateRql("ppi", rql)).not.toThrow();
    expect(rql).toContain("genome(to(genome_id_a)");
  });
});
