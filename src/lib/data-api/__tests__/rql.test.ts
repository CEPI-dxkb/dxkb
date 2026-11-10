import { describe, expect, it } from "vitest";
import {
  eq,
  keywordClauses,
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
    "genome_amr",
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

  it("validates the Strain Genome relationship target", () => {
    expect(
      validateRql(
        "strain",
        "and(eq(genome_ids,*),genome(to(genome_ids),eq(taxon_lineage_ids,561)))",
      ),
    ).toBe(
      "and(eq(genome_ids,%2A),genome(to(genome_ids),eq(taxon_lineage_ids,561)))",
    );
    expect(() =>
      validateRql("strain", "genome(eq(taxon_lineage_ids,561))"),
    ).toThrow(/strain genome requires to\(genome_ids\)/);
    expect(() =>
      serializeRql("strain", {
        operator: "genome",
        operand: { operator: "eq", field: "genus", value: "Influenza" },
      }),
    ).toThrow(/strain genome requires target genome_ids/);
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

    // `splitArguments("")` returns [""], so an empty in(...) must not pass the
    // "at least one value" check with a phantom empty value.
    it("rejects an empty argument list on a string field", () => {
      expect(() => parseRql("genome", "in(genome_id,())")).toThrow(
        /1 to 500 values/,
      );
    });

    // `coerceValue` turns the phantom "" into 0 (Number("")), so it would
    // silently become in(genome_length,(0)).
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

    // A blank slot between commas survives splitArguments as an unquoted ""
    // element, so the length check alone cannot catch it.
    it("rejects an embedded blank element on a string field", () => {
      expect(() => parseRql("genome", "in(genome_id,(1.1,,2.2))")).toThrow(
        /1 to 500 values/,
      );
    });

    it("rejects an embedded blank element on a numeric field", () => {
      expect(() => parseRql("genome", "in(genome_length,(1,,3))")).toThrow(
        /1 to 500 values/,
      );
    });

    it("rejects a leading stray comma", () => {
      expect(() => parseRql("genome", "in(genome_id,(,1,2))")).toThrow(
        /1 to 500 values/,
      );
    });

    it("rejects a trailing stray comma", () => {
      expect(() => parseRql("genome", "in(genome_id,(1,2,))")).toThrow(
        /1 to 500 values/,
      );
    });

    // A quoted empty string is a deliberate value, not an empty list, as in
    // decodeValue().
    it("treats a quoted empty string as one explicit value, not an empty list", () => {
      expect(parseRql("genome", 'in(genome_id,(""))')).toEqual({
        operator: "in",
        field: "genome_id",
        values: [""],
      });
    });

    it("keeps a quoted empty string when mixed with other values", () => {
      expect(parseRql("genome", 'in(genome_id,(1.1,"",2.2))')).toEqual({
        operator: "in",
        field: "genome_id",
        values: ["1.1", "", "2.2"],
      });
    });

    it("round-trips explicit empty and mixed string values", () => {
      for (const expression of [
        { operator: "in", field: "genome_id", values: [""] },
        { operator: "in", field: "genome_id", values: ["1.1", "", "2.2"] },
      ] satisfies RqlIn[]) {
        const serialized = serializeRql("genome", expression);
        expect(parseRql("genome", serialized)).toEqual(expression);
        expect(validateRql("genome", serialized)).toBe(serialized);
      }
    });

    it("rejects empty values for fields whose policy forbids quoting", () => {
      expect(() =>
        serializeRql("serology", {
          operator: "in",
          field: "test_type",
          values: [""],
        }),
      ).toThrow(/cannot be serialized for an unquoted field/);
    });
  });
});

describe("keywordClauses", () => {
  it("sends one clause per word, as legacy BV-BRC's search box does", () => {
    expect(keywordClauses(" coli  Salmonella ", "exact")).toEqual([
      "keyword(coli)",
      "keyword(Salmonella)",
    ]);
    expect(keywordClauses("influenza virus")).toEqual([
      "keyword(influenza%2A)",
      "keyword(virus%2A)",
    ]);
    expect(keywordClauses("  ", "exact")).toEqual([]);
  });

  it("keeps a quoted word's quotes through RQL validation", () => {
    expect(keywordClauses('"Rv0001"', "exact")).toEqual([
      "keyword(%22Rv0001%22)",
    ]);
    expect(validateRql("genome", "keyword(%22Rv0001%22)")).toBe(
      "keyword(%22Rv0001%22)",
    );
  });

  it.each([
    ["a quoted phrase", '"DNA polymerase"', "exact", ["keyword(%22DNA%20polymerase%22)"]],
    [
      "a quoted phrase beside a word, which alone takes the prefix",
      '"DNA polymerase" coli',
      "prefix",
      ["keyword(%22DNA%20polymerase%22)", "keyword(coli%2A)"],
    ],
    ["a quoted word, without a prefix", '"Rv0001"', "prefix", ["keyword(%22Rv0001%22)"]],
    [
      "a quote left open, closed at the end of the text",
      'coli "DNA polymerase',
      "exact",
      ["keyword(coli)", "keyword(%22DNA%20polymerase%22)"],
    ],
    [
      "a phrase's surrounding and repeated spaces",
      '"  DNA   polymerase "',
      "exact",
      ["keyword(%22DNA%20polymerase%22)"],
    ],
    ["empty quotes", '"" coli " "', "exact", ["keyword(coli)"]],
    [
      "a quote that opens inside a word",
      'Rv0001"DNA polymerase"',
      "exact",
      ["keyword(Rv0001)", "keyword(%22DNA%20polymerase%22)"],
    ],
  ] as const)("keeps %s as one clause", (_label, keyword, mode, expected) => {
    expect(keywordClauses(keyword, mode)).toEqual(expected);
  });

  it.each([
    [
      "Solr's NOT",
      "kinase NOT hypothetical",
      "exact",
      ["keyword(kinase)", "not(keyword(hypothetical))"],
    ],
    [
      "Solr's OR, each term prefixed",
      "coli OR Salm",
      "prefix",
      ["or(keyword(coli%2A),keyword(Salm%2A))"],
    ],
    ["a trailing operator", "coli AND", "exact", ["keyword(coli)"]],
    [
      "a field-like word",
      "GO:0003677",
      "exact",
      ["keyword(GO)", "keyword(0003677)"],
    ],
    ["a lone slash", "/", "exact", []],
  ] as const)("reads %s", (_label, keyword, mode, expected) => {
    expect(keywordClauses(keyword, mode)).toEqual(expected);
  });
});

describe("validateRql keyword values", () => {
  // Validation must keep keyword text as written, not re-quote or unquote it.
  it.each([
    ["unquoted words", "keyword(coli Salmonella)", "keyword(coli%20Salmonella)"],
    [
      "encoded unquoted words",
      "keyword(coli%20Salmonella)",
      "keyword(coli%20Salmonella)",
    ],
    ["a quoted word", 'keyword("Rv0001")', "keyword(%22Rv0001%22)"],
    [
      "a quoted phrase",
      'keyword("DNA polymerase")',
      "keyword(%22DNA%20polymerase%22)",
    ],
    [
      "an encoded quoted phrase",
      "keyword(%22DNA%20polymerase%22)",
      "keyword(%22DNA%20polymerase%22)",
    ],
    [
      "a quoted word beside a bare one",
      'keyword("Rv0001" coli)',
      "keyword(%22Rv0001%22%20coli)",
    ],
    ["a prefix", "keyword(Dnak*)", "keyword(Dnak%2A)"],
  ])("keeps %s as written", (_label, rql, expected) => {
    expect(validateRql("genome", rql)).toBe(expected);
    expect(validateRql("genome", expected)).toBe(expected);
  });

  it("still quotes a field value with whitespace", () => {
    expect(
      validateRql("genome", "and(keyword(coli Salmonella),eq(genome_name,E coli))"),
    ).toBe('and(keyword(coli%20Salmonella),eq(genome_name,"E%20coli"))');
  });

  it("rejects malformed percent encoding in a keyword", () => {
    expect(() => validateRql("genome", "keyword(%E0%A4%A)")).toThrow(
      "RQL contains invalid percent encoding.",
    );
  });
});
