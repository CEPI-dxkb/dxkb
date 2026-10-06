import { keywordClauses } from "@/lib/data-api";
import { normalizeLegacyKeyword } from "../legacy-keyword-normalization";
import { searchToQuery } from "./fixtures/legacy-search-to-query";

describe("normalizeLegacyKeyword", () => {
  it("trims the keyword and replaces characters rejected by the query parser", () => {
    expect(normalizeLegacyKeyword("  beta's:+(-),x/y\\z<q>  ")).toBe(
      "betas    x y z q",
    );
  });

  it.each([
    ["fig|83332.12.peg.1 kinase", '"fig|83332.12.peg.1" kinase'],
    ["83332.12", '"83332.12"'],
    ["EC 2.1.1.1", 'EC "2.1.1.1"'],
    ["abc123", '"abc123"'],
  ])("quotes identifier-like tokens in %s", (keyword, expected) => {
    expect(normalizeLegacyKeyword(keyword)).toBe(expected);
  });

  it("preserves an already quoted phrase without grouping characters", () => {
    expect(normalizeLegacyKeyword('"EC 2.1.1.1"')).toBe('"EC 2.1.1.1"');
  });

  it("removes phrase quotes before splitting grouped keywords", () => {
    expect(normalizeLegacyKeyword('"amylase (EC 3.2.1.1)"')).toBe(
      'amylase  EC "3.2.1.1"',
    );
  });

  it("leaves an identifier-like word inside a phrase unquoted", () => {
    // Quoting 2.1.1.1 here would break the phrase; legacy's search box then
    // searches kinase and "enzyme" only.
    expect(normalizeLegacyKeyword('kinase "EC 2.1.1.1 enzyme"')).toBe(
      'kinase "EC 2.1.1.1 enzyme"',
    );
  });

  // Legacy's parser reads and/or/not in any case, but only before another
  // word; ?keyword= reads Solr's uppercase operators.
  it.each([
    ["coli or Salmonella", "coli OR Salmonella"],
    ["kinase Not hypothetical", "kinase NOT hypothetical"],
    ["coli and Salmonella", "coli AND Salmonella"],
    ["kinase not", "kinase not"],
    ['"salt and pepper" or salt', '"salt and pepper" OR salt'],
  ])("writes the operators in %j as Solr's", (keyword, expected) => {
    expect(normalizeLegacyKeyword(keyword)).toBe(expected);
  });

  it("returns an empty string when no searchable characters remain", () => {
    expect(normalizeLegacyKeyword(" +-=<>/\\ ")).toBe("");
  });

  describe("stray quotes", () => {
    // The parser's opening-quote branch assigns instead of appending, so any
    // quote it sees mid-token throws away the text before it. These keywords
    // must reach the parser with the unusable quotes already gone.
    it.each([
      ['foo"bar', "foobar", "keyword(foobar)"],
      ["foo bar\" baz", "foo bar baz", "and(keyword(foo),keyword(bar),keyword(baz))"],
      ['influenza"', "influenza", "keyword(influenza)"],
    ])(
      "keeps every term of %j searchable",
      (keyword, expectedNormalized, expectedQuery) => {
        const normalized = normalizeLegacyKeyword(keyword);
        expect(normalized).toBe(expectedNormalized);
        expect(searchToQuery(normalized)).toBe(expectedQuery);
        expect(normalized).not.toContain('"');
      },
    );

    it("strips embedded quotes but keeps a balanced phrase", () => {
      expect(normalizeLegacyKeyword('foo"bar "EC 2.1.1.1" x"y')).toBe(
        'foobar "EC 2.1.1.1" xy',
      );
    });

    it.each([
      ['"EC 2.1.1.1" extra"', '"EC 2.1.1.1" extra'],
      ['stray" "EC 2.1.1.1"', 'stray "EC 2.1.1.1"'],
    ])(
      "preserves a valid phrase when another quote in %j is unmatched",
      (keyword, expected) => {
        const normalized = normalizeLegacyKeyword(keyword);

        expect(normalized).toBe(expected);
        expect(searchToQuery(normalized)).toContain(
          "keyword(%22EC%202.1.1.1%22)",
        );
      },
    );

    // A list's keyword box closes a quote left open (`keywordTerms`), the
    // phrase being typed: "DNA polymerase is 17 genomes, the words apart 55.
    // Legacy sends the open quote to Solr, which rejects it.
    it.each([
      ['"foo bar', '"foo bar"'],
      ['kinase "EC 2.1.1.1', 'kinase "EC 2.1.1.1"'],
      ['"EC 2.1.1.1" kinase "DNA pol', '"EC 2.1.1.1" kinase "DNA pol"'],
    ])("closes the phrase left open in %j", (keyword, expected) => {
      expect(normalizeLegacyKeyword(keyword)).toBe(expected);
    });

    it("drops an open quote before a balanced phrase", () => {
      expect(normalizeLegacyKeyword('"foo "bar" baz')).toBe('foo "bar" baz');
    });

    it("strips every quote when removing embedded ones orphans a partner", () => {
      expect(normalizeLegacyKeyword('a"b c" d')).toBe("ab c d");
    });
  });
});

/** The RQL a list sends for ?keyword=<text>, as the exact lists build it. */
function listRql(keyword: string): string {
  const clauses = keywordClauses(keyword, "exact");
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

describe("the ?keyword= the search bar writes", () => {
  // Alpha's search box sends searchToQuery(normalized text); a DXKB list sends
  // keywordClauses(normalized text). Both read the same (DXKB-normalized)
  // text, so this checks the reading; the normalization's own cases are above.
  // Compared decoded: the two encode `*` differently.
  it.each([
    "Rv0001",
    "DNA polymerase",
    '"DNA polymerase"',
    '"DNA polymerase" coli',
    "kinase not hypothetical",
    "coli or Salmonella",
    "coli OR Salmonella OR Shigella",
    "E coli OR Salmonella",
    "coli and Salmonella",
    "fig|83332.12.peg.1 kinase",
    "83332.12",
    "EC 2.1.1.1",
    '"EC 2.1.1.1"',
    "polymerase GO:0003677",
    "H1N1/2009",
    "coli -Salmonella",
    "beta-lactamase",
    "5'-nucleotidase",
    "amylase (EC 3.2.1.1)",
    '"amylase (EC 3.2.1.1)"',
    "kin*se",
  ])("reads %j as legacy's search box parses it", (typed) => {
    const keyword = normalizeLegacyKeyword(typed);
    expect(decodeURIComponent(listRql(keyword))).toBe(
      decodeURIComponent(searchToQuery(keyword)),
    );
  });

  it("offers a NOT inside an OR as the OR of everything else", () => {
    // Legacy sends or(not(keyword(coli)),keyword(Salmonella)), which the Data
    // API reads as Lucene does, Salmonella AND NOT coli: 61,384 genomes. Not
    // coli, or Salmonella, is 16,901,125.
    const keyword = normalizeLegacyKeyword("not coli or Salmonella");
    expect(listRql(keyword)).toBe(
      "or(and(keyword(*),not(keyword(coli))),keyword(Salmonella))",
    );
    expect(searchToQuery(keyword)).toBe(
      "or(not(keyword(coli)),keyword(Salmonella))",
    );
  });

  it("keeps the terms after an OR group ANDed, where legacy ORs them", () => {
    const keyword = normalizeLegacyKeyword("kinase or phosphatase human");
    expect(listRql(keyword)).toBe(
      "and(or(keyword(kinase),keyword(phosphatase)),keyword(human))",
    );
    expect(searchToQuery(keyword)).toBe(
      "or(keyword(kinase),keyword(phosphatase),keyword(human))",
    );
  });
});
