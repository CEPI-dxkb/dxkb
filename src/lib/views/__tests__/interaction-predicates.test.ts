import { parseRql, validateRql } from "@/lib/data-api";
import type { RqlExpression } from "@/lib/data-api/rql";
import {
  featureInteractionsRql,
  genomeInteractionsRql,
  taxonomyInteractionsRql,
} from "../child-resources";

/**
 * A PPI row's A and B sides have identical shapes and nothing says which
 * carries the scoped organism, so an A-only predicate silently drops every
 * B-side row.
 * Only the `and`/`or`/`eq`/`ne` subset is interpreted; anything else fails
 * deliberately.
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
    // A-side only by necessity: the contract allowlists a single join target
    // for ppi.
    const rql = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");

    expect(() => validateRql("ppi", rql)).not.toThrow();
    expect(() =>
      validateRql("ppi", rql.replace("genome_id_a)", "genome_id_b)")),
    ).toThrow(/genome_id_a/);
  });
});
