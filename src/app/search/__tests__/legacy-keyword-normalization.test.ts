import { normalizeLegacyKeyword } from "../legacy-keyword-normalization";
import { searchToQuery } from "../search-to-query";

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
      ['"foo bar', "foo bar", "and(keyword(foo),keyword(bar))"],
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

    it("strips every quote when removing embedded ones orphans a partner", () => {
      expect(normalizeLegacyKeyword('a"b c" d')).toBe("ab c d");
    });
  });
});
