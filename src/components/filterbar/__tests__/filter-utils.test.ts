import { parseRql, validateRql } from "@/lib/data-api";
import { buildRql, combineRql } from "../filter-utils";

// `buildRql` builds the predicate for the legacy Search filter bar
// (`filter-bar.tsx`), which is the only consumer: the modern collection views
// build their filters structurally and serialize them with `serializeRql`.
// Its output is sent to the same-origin Data API gateway as `rql`, so every
// assertion below is paired with the gateway's own `validateRql` — what the
// upstream service finally receives is that re-serialized form, not this one.
describe("buildRql", () => {
  it("percent-encodes an eq() value and leaves the quoting to the gateway", () => {
    const rql = buildRql({
      selected: [{ field: "epitope_type", value: "Linear peptide", op: "eq" }],
      keywords: [],
    });
    expect(rql).toBe("eq(epitope_type,Linear%20peptide)");
    // Regression: this used to wrap the value in `%22`, which decoded to a
    // value whose content was `"Linear peptide"` — quote characters included —
    // so Solr matched on the quotes instead of the phrase. The gateway adds
    // the phrase quoting itself, exactly once.
    expect(validateRql("epitope", rql)).toBe(
      'eq(epitope_type,"Linear%20peptide")',
    );
  });

  it("leaves a single-word eq() value unquoted through the gateway", () => {
    const rql = buildRql({
      selected: [{ field: "genome_status", value: "Complete", op: "eq" }],
      keywords: [],
    });
    expect(rql).toBe("eq(genome_status,Complete)");
    expect(validateRql("genome", rql)).toBe("eq(genome_status,Complete)");
  });

  it("groups repeated values for one field into an or()", () => {
    const rql = buildRql({
      selected: [
        { field: "epitope_type", value: "Linear peptide", op: "eq" },
        { field: "epitope_type", value: "Discontinuous peptide", op: "eq" },
      ],
      keywords: [],
    });
    expect(rql).toBe(
      "or(eq(epitope_type,Linear%20peptide),eq(epitope_type,Discontinuous%20peptide))",
    );
    expect(validateRql("epitope", rql)).toBe(
      'or(eq(epitope_type,"Linear%20peptide"),eq(epitope_type,"Discontinuous%20peptide"))',
    );
  });

  it("joins different fields with and()", () => {
    const rql = buildRql({
      selected: [
        { field: "epitope_type", value: "Linear peptide", op: "eq" },
        { field: "host_name", value: "Homo sapiens, human", op: "eq" },
      ],
      keywords: [],
    });
    expect(rql).toBe(
      "and(eq(epitope_type,Linear%20peptide),eq(host_name,Homo%20sapiens%2C%20human))",
    );
    // The comma inside the value stays encoded, so it is never read as an
    // argument separator.
    expect(validateRql("epitope", rql)).toBe(
      'and(eq(epitope_type,"Linear%20peptide"),eq(host_name,"Homo%20sapiens%2C%20human"))',
    );
  });

  it("encodes parentheses inside an eq() value", () => {
    const rql = buildRql({
      selected: [
        { field: "host_name", value: "Mus musculus B10.A(4R", op: "eq" },
      ],
      keywords: [],
    });
    expect(rql).toBe("eq(host_name,Mus%20musculus%20B10.A%284R)");
    expect(validateRql("epitope", rql)).toBe(
      'eq(host_name,"Mus%20musculus%20B10.A%284R")',
    );
  });

  it("builds a prefix keyword clause the gateway accepts", () => {
    const rql = buildRql({ selected: [], keywords: ["influenza"] });
    expect(rql).toBe("keyword(influenza*)");
    // The gateway re-encodes `*` as `%2A`; the decoded value is unchanged.
    expect(parseRql("genome", validateRql("genome", rql))).toEqual({
      operator: "keyword",
      value: "influenza*",
    });
  });

  it("returns empty string when nothing is selected", () => {
    expect(buildRql({ selected: [], keywords: [] })).toBe("");
  });
});

describe("combineRql", () => {
  it("returns the single non-empty clause unchanged", () => {
    expect(combineRql("keyword(influenza*)", "")).toBe("keyword(influenza*)");
    expect(combineRql("", "eq(mol_type,DNA)")).toBe("eq(mol_type,DNA)");
    expect(combineRql(undefined, undefined)).toBe("");
  });

  // Regression: the facet request used to join the base query and the filter
  // with `&`, the legacy transport separator. The gateway parses `rql` as a
  // single RQL expression, so that form is rejected outright.
  it("conjoins clauses with and(), which the gateway parses", () => {
    const combined = combineRql("keyword(influenza*)", "eq(mol_type,DNA)");
    expect(combined).toBe("and(keyword(influenza*),eq(mol_type,DNA))");
    expect(() => validateRql("genome_sequence", combined)).not.toThrow();
    expect(() =>
      validateRql("genome_sequence", "keyword(influenza*)&eq(mol_type,DNA)"),
    ).toThrow();
  });
});
