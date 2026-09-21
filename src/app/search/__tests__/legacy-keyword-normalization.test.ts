import { normalizeLegacyKeyword } from "../legacy-keyword-normalization";

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
});
