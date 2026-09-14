import { describe, expect, it } from "vitest";
import {
  eq,
  maxRqlInValues,
  parseRql,
  serializeRql,
  validateRql,
} from "../rql";
import type { RqlIn } from "../rql";

describe("typed RQL", () => {
  it("round-trips structural predicates and field types", () => {
    expect(
      parseRql("genome", "and(eq(genome_id,83332.12),ge(genome_length,1000))"),
    ).toEqual({
      operator: "and",
      operands: [
        { operator: "eq", field: "genome_id", value: "83332.12" },
        { operator: "ge", field: "genome_length", value: 1000 },
      ],
    });
  });

  it("quotes tokenized phrase fields and safely encodes delimiters", () => {
    expect(eq("strain", "strain", "A/B, isolate (one)")).toBe(
      "eq(strain,\"A%2FB%2C%20isolate%20%28one%29\")",
    );
    expect(eq("surveillance", "pathogen_test_type", "RAT/antigen")).toBe(
      "eq(pathogen_test_type,\"RAT%2Fantigen\")",
    );
    expect(eq("serology", "test_type", "neutralizing antibody")).toBe(
      "eq(test_type,neutralizing%20antibody)",
    );
  });

  it("serializes nested expressions", () => {
    expect(
      serializeRql("epitope", {
        operator: "or",
        operands: [
          { operator: "eq", field: "epitope_type", value: "Linear peptide" },
          { operator: "keyword", value: "influenza" },
        ],
      }),
    ).toBe('or(eq(epitope_type,"Linear%20peptide"),keyword(influenza))');
  });

  it.each([
    "genome_feature",
    "genome_sequence",
    "protein_feature",
    "protein_structure",
    "bioset",
  ] as const)("validates Genome relationship predicates for %s", (resource) => {
    const rql =
      "genome(and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated)))";

    expect(validateRql(resource, rql)).toBe(rql);
  });

  it("validates the PPI Genome relationship target", () => {
    const rql =
      "genome(to(genome_id_a),and(eq(taxon_lineage_ids,561),ne(genome_status,Deprecated)))";

    expect(validateRql("ppi", rql)).toBe(rql);
    expect(() =>
      validateRql("ppi", "genome(to(genome_id_b),eq(taxon_lineage_ids,561))"),
    ).toThrow(/genome_id_a/);
  });

  it("rejects Genome relationships for unsupported resources and fields", () => {
    expect(() =>
      validateRql("epitope", "genome(eq(genome_status,Complete))"),
    ).toThrow(/Unsupported RQL operator: genome/);
    expect(() =>
      validateRql("genome_feature", "genome(eq(secret,value))"),
    ).toThrow(/Field secret is not allowed for genome/);
  });

  it.each([
    "select(genome_id)",
    "sort(+genome_id)",
    "limit(200)",
    "facet(genus)",
  ])("rejects transport operator %s", (rql) => {
    expect(() => validateRql("genome", rql)).toThrow(/not allowed/);
  });

  it("accepts wildcard equality for numeric fields", () => {
    expect(validateRql("taxonomy", "eq(taxon_id,*)")).toBe(
      "eq(taxon_id,%2A)",
    );
    expect(() => validateRql("taxonomy", "gt(taxon_id,*)")).toThrow(
      /numeric value is invalid/i,
    );
  });

  it("enforces each field's allowed operators", () => {
    expect(() => validateRql("genome", "gt(genome_id,1.1)")).toThrow(
      /Operator gt is not allowed/,
    );
    expect(validateRql("genome", "ge(genome_length,1000)")).toBe(
      "ge(genome_length,1000)",
    );
    expect(validateRql("genome_feature", "gt(na_length,100)")).toBe(
      "gt(na_length,100)",
    );
    expect(
      validateRql("protein_structure", "ge(date_inserted,2020-01-01)"),
    ).toBe("ge(date_inserted,2020-01-01)");
  });

  it("rejects unknown fields, malformed input, and excessive nesting", () => {
    expect(() => validateRql("genome", "eq(secret,x)")).toThrow(/not allowed/);
    expect(() => validateRql("genome", "eq(genome_id,x")).toThrow(/Malformed/);
    const nested = `${"not(".repeat(14)}eq(genome_id,x)${")".repeat(14)}`;
    expect(() => validateRql("genome", nested)).toThrow(/too deep/);
  });

  describe("in(...) argument-list validation", () => {
    it("accepts a single value", () => {
      expect(parseRql("genome", "in(genome_id,(83332.12))")).toEqual({
        operator: "in",
        field: "genome_id",
        values: ["83332.12"],
      });
    });

    it(`accepts the ${maxRqlInValues.toLocaleString()}-value boundary`, () => {
      const values = Array.from({ length: maxRqlInValues }, (_, i) =>
        String(i),
      );
      const rql = `in(genome_id,(${values.join(",")}))`;
      const parsed = parseRql("genome", rql) as RqlIn;
      expect(parsed.values).toHaveLength(maxRqlInValues);
      expect(parsed.values[0]).toBe("0");
      expect(parsed.values.at(-1)).toBe(String(maxRqlInValues - 1));
    });

    it(`rejects ${(maxRqlInValues + 1).toLocaleString()} values`, () => {
      const values = Array.from({ length: maxRqlInValues + 1 }, (_, i) =>
        String(i),
      );
      const rql = `in(genome_id,(${values.join(",")}))`;
      expect(() => parseRql("genome", rql)).toThrow(/1 to 500 values/);
    });

    // splitArguments("") returns [""] (it always emits at least one part),
    // so an empty in(...) argument list used to be indistinguishable from a
    // single empty-string value and would pass the "at least one value"
    // check below with a phantom "" entry.
    it("rejects an empty argument list on a string field", () => {
      expect(() => parseRql("genome", "in(genome_id,())")).toThrow(
        /1 to 500 values/,
      );
    });

    // On a numeric field the same phantom "" value was worse: coerceValue
    // calls Number(""), which is 0 (not NaN), so in(genome_length,()) used
    // to silently become in(genome_length,(0)) instead of being rejected.
    it("rejects an empty argument list on a numeric field", () => {
      expect(() => parseRql("genome", "in(genome_length,())")).toThrow(
        /1 to 500 values/,
      );
    });

    it("rejects a whitespace-only argument list", () => {
      expect(() => parseRql("genome", "in(genome_id,(   ))")).toThrow(
        /1 to 500 values/,
      );
    });

    // Documented contract: a *quoted* empty string is a deliberate value,
    // not an empty list — consistent with decodeValue() elsewhere in this
    // parser, where eq(field,"") already decodes to the empty string rather
    // than being rejected. Only a bare, unquoted empty interior means "no
    // values".
    it("treats a quoted empty string as one explicit value, not an empty list", () => {
      expect(parseRql("genome", 'in(genome_id,(""))')).toEqual({
        operator: "in",
        field: "genome_id",
        values: [""],
      });
    });
  });
});
