import { describe, expect, it } from "vitest";
import { keywordQuery, keywordQueryClauses, keywordTerms } from "../keyword-terms";

/** The clauses for `text`, terms unencoded so the cases read as written. */
function clauses(text: string): string[] {
  return keywordQueryClauses(keywordQuery(text), (term) => term);
}

describe("keywordTerms", () => {
  it("splits a search into words and quoted phrases", () => {
    expect(keywordTerms(' coli  "DNA  polymerase" "Rv0001"')).toEqual([
      "coli",
      '"DNA polymerase"',
      '"Rv0001"',
    ]);
    expect(keywordTerms('"DNA polymerase')).toEqual(['"DNA polymerase"']);
    expect(keywordTerms('  "" ')).toEqual([]);
  });

  it("keeps Solr's exclusion on the phrase it excludes", () => {
    expect(keywordTerms('coli -"DNA  polymerase" -""')).toEqual([
      "coli",
      '-"DNA polymerase"',
    ]);
  });
});

describe("keywordQuery operators", () => {
  it.each([
    ["coli Salmonella", ["keyword(coli)", "keyword(Salmonella)"]],
    ["coli AND Salmonella", ["keyword(coli)", "keyword(Salmonella)"]],
    ["coli OR Salmonella", ["or(keyword(coli),keyword(Salmonella))"]],
    [
      "coli OR Salmonella OR Shigella",
      ["or(keyword(coli),keyword(Salmonella),keyword(Shigella))"],
    ],
    // OR binds tighter than the implicit AND, as legacy's search box parses it:
    // and(keyword(E),or(keyword(coli),keyword(Salmonella))) is 25,228 genomes.
    [
      "E coli OR Salmonella",
      ["keyword(E)", "or(keyword(coli),keyword(Salmonella))"],
    ],
    [
      "coli OR Salmonella plasmid",
      ["or(keyword(coli),keyword(Salmonella))", "keyword(plasmid)"],
    ],
    ["kinase NOT hypothetical", ["keyword(kinase)", "not(keyword(hypothetical))"]],
    // Solr's `-` exclusion is a NOT: keyword(coli -Salmonella) is 132,341
    // genomes, the same as and(keyword(coli),not(keyword(Salmonella))).
    ["coli -Salmonella", ["keyword(coli)", "not(keyword(Salmonella))"]],
    // keyword(coli -"DNA polymerase") is 134,273 genomes, the phrase excluded.
    [
      'coli -"DNA polymerase"',
      ["keyword(coli)", 'not(keyword("DNA polymerase"))'],
    ],
    ["+coli", ["keyword(coli)"]],
    ["--coli", ["keyword(coli)"]],
    ["coli OR OR Salmonella", ["or(keyword(coli),keyword(Salmonella))"]],
    // Solr's `||` is its OR: keyword(coli || Salmonella) is 195,658 genomes.
    ["coli || Salmonella", ["or(keyword(coli),keyword(Salmonella))"]],
    // A quoted operator is a phrase.
    ['coli "OR" Salmonella', ["keyword(coli)", 'keyword("OR")', "keyword(Salmonella)"]],
  ])("reads %j", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

  // A group with no positive term matches nothing once the Data API brackets
  // it: and(eq(genome_id,*),and(not(keyword(coli)),not(keyword(Salmonella))))
  // is 0 genomes, with keyword(*) beside the NOTs 16,837,798, as alone. So a
  // search of only NOTs, and each NOT an OR offers, matches against keyword(*).
  it.each([
    ["NOT hypothetical", ["keyword(*)", "not(keyword(hypothetical))"]],
    ["NOT NOT hypothetical", ["keyword(*)", "not(keyword(hypothetical))"]],
    ["-coli", ["keyword(*)", "not(keyword(coli))"]],
    [
      "NOT hypothetical NOT putative",
      ["keyword(*)", "not(keyword(hypothetical))", "not(keyword(putative))"],
    ],
    [
      "coli OR NOT Salmonella",
      ["or(keyword(coli),and(keyword(*),not(keyword(Salmonella))))"],
    ],
    [
      'NOT "DNA polymerase" OR helicase',
      ['or(and(keyword(*),not(keyword("DNA polymerase"))),keyword(helicase))'],
    ],
    [
      "kinase NOT coli OR NOT hypothetical",
      [
        "keyword(kinase)",
        "or(and(keyword(*),not(keyword(coli))),and(keyword(*),not(keyword(hypothetical))))",
      ],
    ],
  ])("anchors the negations in %j", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

  it("reads lowercase and, or and not as words, as Solr does", () => {
    expect(clauses("salt and pepper or not")).toEqual([
      "keyword(salt)",
      "keyword(and)",
      "keyword(pepper)",
      "keyword(or)",
      "keyword(not)",
    ]);
  });

  // Each of these alone is a Solr SyntaxError as a clause of its own.
  it.each([
    ["OR coli", ["keyword(coli)"]],
    ["coli OR", ["keyword(coli)"]],
    ["coli AND", ["keyword(coli)"]],
    ["AND coli", ["keyword(coli)"]],
    ["coli NOT", ["keyword(coli)"]],
    ["OR", []],
    ["NOT", []],
    ["AND OR NOT", []],
    ["-", []],
  ])("drops the operator with nothing to join in %j", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });
});

describe("keywordQuery syntax characters", () => {
  // Solr splits a word at punctuation and ANDs the parts, so these read as
  // written: keyword(coli-K12) and and(keyword(coli),keyword(K12)) are both
  // 1,666 genomes, keyword(H1N1/2009) and the parts ANDed both 212,338.
  it.each([
    ["coli-K12", ["keyword(coli)", "keyword(K12)"]],
    ["H1N1/2009", ["keyword(H1N1)", "keyword(2009)"]],
    ["coli,salmonella", ["keyword(coli)", "keyword(salmonella)"]],
  ])("splits %j where Solr does", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

  it("keeps a word's parts together as one term", () => {
    // keyword(coli OR Salmonella-enterica) is 193,964 genomes, as
    // or(keyword(coli),and(keyword(Salmonella),keyword(enterica))); ANDing
    // `enterica` beside the OR would find 60,655.
    expect(clauses("coli OR Salmonella-enterica")).toEqual([
      "or(keyword(coli),and(keyword(Salmonella),keyword(enterica)))",
    ]);
    // keyword(Escherichia -coli-K12) is 129,340, as the NOT of both parts.
    expect(clauses("Escherichia -coli-K12")).toEqual([
      "keyword(Escherichia)",
      "not(and(keyword(coli),keyword(K12)))",
    ]);
  });

  it("keeps a pipe inside a word and drops a lone one", () => {
    // keyword("fig|83332.12.peg.1") is the 1 feature legacy's search finds.
    expect(clauses('"fig|83332.12.peg.1" coli |')).toEqual([
      'keyword("fig|83332.12.peg.1")',
      "keyword(coli)",
    ]);
  });

  it("reads an operator word left by the syntax as a word", () => {
    // keyword("OR") is 652,558 genomes; keyword(OR) is a SyntaxError.
    expect(clauses("(OR) -NOT")).toEqual([
      'keyword("OR")',
      'not(keyword("NOT"))',
    ]);
  });

  // Each of these sent as written is an HTTP 400: Solr syntax (`:` names a
  // field, a leading `-` is a pure negative query, `[`, `{`, `^`, `\`, `&`)
  // or a character the Data API rejects outright (`!`, `~`, `'`, an
  // unbalanced parenthesis).
  it.each([
    ["polymerase GO:0003677", ["keyword(polymerase)", "keyword(GO)", "keyword(0003677)"]],
    ["(p)ppGpp", ["keyword(p)", "keyword(ppGpp)"]],
    ["a(b", ["keyword(a)", "keyword(b)"]],
    ["[coli] {coli}", ["keyword(coli)", "keyword(coli)"]],
    ["5'-nucleotidase", ["keyword(5)", "keyword(nucleotidase)"]],
    ["coli! coli~ coli^ coli\\", [
      "keyword(coli)",
      "keyword(coli)",
      "keyword(coli)",
      "keyword(coli)",
    ]],
    ["100% a&b x<y z>w q=r", [
      "keyword(100)",
      "keyword(a)",
      "keyword(b)",
      "keyword(x)",
      "keyword(y)",
      "keyword(z)",
      "keyword(w)",
      "keyword(q)",
      "keyword(r)",
    ]],
  ])("neutralizes the syntax in %j", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

  it("neutralizes syntax inside a phrase, which Solr splits the same way", () => {
    // "GO:0003677" and "GO 0003677" are both 482,719 features.
    expect(clauses('"GO:0003677" "(p)ppGpp synthetase"')).toEqual([
      'keyword("GO 0003677")',
      'keyword("p ppGpp synthetase")',
    ]);
  });

  it("keeps wildcards", () => {
    expect(clauses("kin*se col?i *coli")).toEqual([
      "keyword(kin*se)",
      "keyword(col?i)",
      "keyword(*coli)",
    ]);
  });

  it("finds no terms in text that is only syntax", () => {
    expect(keywordQuery("!!! ~ () && || - / \\ % ' \"\" ")).toEqual([]);
    expect(keywordQuery("")).toEqual([]);
  });
});

describe("keywordQueryClauses", () => {
  it("encodes each term's text", () => {
    expect(
      keywordQueryClauses(keywordQuery('"DNA polymerase" OR coli'), (term) =>
        encodeURIComponent(term),
      ),
    ).toEqual(["or(keyword(%22DNA%20polymerase%22),keyword(coli))"]);
  });
});
