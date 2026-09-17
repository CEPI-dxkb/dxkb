import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import {
  decodeQueryValue,
  equalsValue,
  hasCall,
  hasClause,
  hasKeyword,
  parseFixtureQuery,
} from "../query";

const loopback = "http://localhost:3020/api/e2e-mock/data/surveillance/";

function parse(search: string) {
  return parseFixtureQuery(mockNextRequest({ url: `${loopback}${search}` }));
}

/**
 * The two shapes a clause arrives in. `repository` is what
 * `ServerDataRepository` puts on the wire; `normalised` is what Next hands a
 * route handler after running that query through a `URLSearchParams` round
 * trip. Every matcher has to read both identically — the Surveillance
 * compound-member failure was a matcher that only understood the first.
 */
function normalise(repositorySearch: string): string {
  return `?${new URLSearchParams(repositorySearch.replace(/^\?/, "")).toString()}`;
}

describe("decodeQueryValue", () => {
  it("strips serializeValue's quoting", () => {
    expect(decodeQueryValue('"RAT%2Fantigen"')).toBe("RAT/antigen");
  });

  it("decodes a slash value", () => {
    expect(decodeQueryValue("sample%2F1")).toBe("sample/1");
  });

  it("reads + as the space the form-urlencoded transport made of it", () => {
    expect(decodeQueryValue('"Nasal+swab"')).toBe("Nasal swab");
  });

  it("returns a malformed escape unchanged instead of throwing", () => {
    expect(decodeQueryValue("50%")).toBe("50%");
    expect(decodeQueryValue("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("parseFixtureQuery — clause extraction", () => {
  it("splits the repository's raw clause list", () => {
    const query = parse("?eq(sample_identifier,sample%2F1)&limit(1)");
    expect(query.clauses).toEqual([
      "eq(sample_identifier,sample/1)",
      "limit(1)",
    ]);
  });

  it("recovers the same clause list from the normalised form Next delivers", () => {
    const repositorySearch =
      "?eq(sample_identifier,sample%2F1)&facet(pathogen_test_type)";
    expect(parse(normalise(repositorySearch)).clauses).toEqual(
      parse(repositorySearch).clauses,
    );
  });

  it("keeps + inside clause text so sort() still matches verbatim", () => {
    const sort = "sort(+genome_name,+genome_id)";
    for (const search of [`?${sort}`, normalise(`?${sort}`)]) {
      expect(hasClause(parse(search), sort)).toBe(true);
    }
  });

  it("recognises calls by name and reports an absent one", () => {
    const query = parse("?select(genome_id,genome_name)&limit(25000)");
    expect(hasCall(query, "select")).toBe(true);
    expect(hasCall(query, "facet")).toBe(false);
  });

  it("returns an empty parse for a query-less request", () => {
    const query = parse("");
    expect(query).toMatchObject({ search: "", clauses: [], equals: [], keywords: [] });
  });
});

describe("parseFixtureQuery — predicate extraction", () => {
  it.each([
    [
      "repository form",
      '?and(eq(sample_identifier,sample%2F1),eq(pathogen_test_type,%22RAT%2Fantigen%22))',
    ],
    [
      "Next-normalised form",
      normalise(
        '?and(eq(sample_identifier,sample%2F1),eq(pathogen_test_type,%22RAT%2Fantigen%22))',
      ),
    ],
    [
      "double-encoded form (page params Next left percent-encoded)",
      normalise(
        '?and(eq(sample_identifier,sample%252F1),eq(pathogen_test_type,%22RAT%2Fantigen%22))',
      ),
    ],
  ])("decodes slash values identically in the %s", (_name, search) => {
    const query = parse(search);
    expect(equalsValue(query, "sample_identifier")).toBe("sample/1");
    expect(equalsValue(query, "pathogen_test_type")).toBe("RAT/antigen");
  });

  it.each([
    ["repository form", `?eq(sample_identifier,${encodeURIComponent("50%")})`],
    [
      "Next-normalised form",
      normalise(`?eq(sample_identifier,${encodeURIComponent("50%")})`),
    ],
  ])("recovers a literal-percent identifier from the %s", (_name, search) => {
    // A malformed escape after the transport decode (`50%`) must fall back to
    // the raw text rather than throw — and must not be confused with a value
    // whose percent sequence really was an encoded character.
    expect(equalsValue(parse(search), "sample_identifier")).toBe("50%");
  });

  it("keeps a percent-bearing identifier distinct from a slash-bearing one", () => {
    const percent = parse(
      normalise(`?eq(sample_identifier,${encodeURIComponent("50%")})`),
    );
    const slash = parse(
      normalise(`?eq(sample_identifier,${encodeURIComponent("50/")})`),
    );
    expect(equalsValue(percent, "sample_identifier")).toBe("50%");
    expect(equalsValue(slash, "sample_identifier")).toBe("50/");
  });

  it("extracts nested predicates from a genome() relationship clause", () => {
    const query = parse(
      normalise("?eq(genome_id,*)&genome(eq(taxon_lineage_ids,234))"),
    );
    expect(equalsValue(query, "taxon_lineage_ids")).toBe("234");
    expect(equalsValue(query, "genome_id")).toBe("*");
  });

  it("reports undefined for a field the query does not filter on", () => {
    const query = parse("?eq(test_type,LAMP)");
    expect(equalsValue(query, "test_type")).toBe("LAMP");
    expect(equalsValue(query, "pathogen_test_type")).toBeUndefined();
  });

  it("does not let a fixture id match a longer id by substring", () => {
    const query = parse(normalise("?eq(taxon_lineage_ids,1234)"));
    expect(equalsValue(query, "taxon_lineage_ids")).toBe("1234");
    expect(equalsValue(query, "taxon_lineage_ids")).not.toBe("234");
  });

  it("collects keywords decoded, in both wire forms", () => {
    for (const search of [
      "?and(keyword(MERS%2A),keyword(%22Nasal%20swab%22))",
      normalise("?and(keyword(MERS%2A),keyword(%22Nasal%20swab%22))"),
    ]) {
      const query = parse(search);
      expect(hasKeyword(query, "MERS*")).toBe(true);
      expect(hasKeyword(query, "Nasal swab")).toBe(true);
      expect(hasKeyword(query, "MERS")).toBe(false);
    }
  });
});
