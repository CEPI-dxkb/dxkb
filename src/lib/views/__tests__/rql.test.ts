import { escapeRqlValue, rqlEq, rqlKeyword } from "../rql";

describe("escapeRqlValue", () => {
  it("passes plain alphanumeric values through unchanged", () => {
    expect(escapeRqlValue("Escherichia")).toBe("Escherichia");
  });
  it("percent-encodes RQL-special characters", () => {
    expect(escapeRqlValue("a,b")).toBe("a%2Cb");
    expect(escapeRqlValue("flu)")).toBe("flu%29");
    expect(escapeRqlValue("(x")).toBe("%28x");
  });
});

describe("rqlEq / rqlKeyword", () => {
  it("builds an eq clause with an escaped value", () => {
    expect(rqlEq("genus", "Escherichia")).toBe("eq(genus,Escherichia)");
    expect(rqlEq("name", "a,b")).toBe("eq(name,a%2Cb)");
  });
  it("builds one keyword clause per term", () => {
    // `keywordQuery` reads the RQL-special characters as the spaces Solr
    // splits a word at, so none can break out of its clause.
    expect(rqlKeyword("flu)")).toBe("keyword(flu)");
    expect(rqlKeyword("a,b")).toBe("and(keyword(a),keyword(b))");
  });
  it("keeps a quoted phrase and closes a quote left open", () => {
    // Solr rejects an unbalanced quote (TokenMgrError), so a refinement typed
    // as `"DNA polymerase` reads as the phrase it is heading for.
    expect(rqlKeyword('coli "DNA polymerase"')).toBe(
      'and(keyword(coli),keyword("DNA polymerase"))',
    );
    expect(rqlKeyword('coli "DNA polymerase')).toBe(
      'and(keyword(coli),keyword("DNA polymerase"))',
    );
  });
  // The Data API joins a keyword's text into the surrounding query without
  // brackets, so an OR inside one clause leaks out of it:
  // and(eq(genome_id,*),keyword(coli OR Salmonella)) lists all 17,033,311
  // genomes, and(eq(genome_id,*),or(keyword(coli),keyword(Salmonella))) the
  // 195,658 that keyword(coli OR Salmonella) alone finds.
  it.each([
    ["coli OR Salmonella", "or(keyword(coli),keyword(Salmonella))"],
    ['"DNA polymerase" OR helicase', 'or(keyword("DNA polymerase"),keyword(helicase))'],
    [
      "E coli OR Salmonella",
      "and(keyword(E),or(keyword(coli),keyword(Salmonella)))",
    ],
    ["coli OR", "keyword(coli)"],
    ["OR", undefined],
    // Lowercase `or` is a word to Solr, not an operator.
    [
      "coli or Salmonella",
      "and(keyword(coli),keyword(or),keyword(Salmonella))",
    ],
  ])("sends %s's OR as RQL or()", (value, expected) => {
    expect(rqlKeyword(value)).toBe(expected);
  });
  // Each of these as one keyword() clause is a Solr or Data API error.
  it.each([
    ["kinase NOT hypothetical", "and(keyword(kinase),not(keyword(hypothetical)))"],
    ["coli AND", "keyword(coli)"],
    [
      "polymerase GO:0003677",
      "and(keyword(polymerase),keyword(GO),keyword(0003677))",
    ],
    ["/", undefined],
  ])("reads %j without Solr syntax", (value, expected) => {
    expect(rqlKeyword(value)).toBe(expected);
  });
  it("builds no clause from text without terms", () => {
    // A lone `"` typed to start a phrase is nothing to search for yet; sent as
    // keyword("") it would list nothing.
    expect(rqlKeyword('"')).toBeUndefined();
    expect(rqlKeyword('  "" ')).toBeUndefined();
  });
});
