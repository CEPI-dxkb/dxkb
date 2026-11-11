import { describe, expect, it } from "vitest";
import { keywordQuery, keywordQueryClauses, keywordTerms } from "../keyword-terms";

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
    [
      "E coli OR Salmonella",
      ["keyword(E)", "or(keyword(coli),keyword(Salmonella))"],
    ],
    [
      "coli OR Salmonella plasmid",
      ["or(keyword(coli),keyword(Salmonella))", "keyword(plasmid)"],
    ],
    ["kinase NOT hypothetical", ["keyword(kinase)", "not(keyword(hypothetical))"]],
    ["coli -Salmonella", ["keyword(coli)", "not(keyword(Salmonella))"]],
    [
      'coli -"DNA polymerase"',
      ["keyword(coli)", 'not(keyword("DNA polymerase"))'],
    ],
    ["+coli", ["keyword(coli)"]],
    ["--coli", ["keyword(coli)"]],
    ["coli OR OR Salmonella", ["or(keyword(coli),keyword(Salmonella))"]],
    ["coli || Salmonella", ["or(keyword(coli),keyword(Salmonella))"]],
    ['coli "OR" Salmonella', ["keyword(coli)", 'keyword("OR")', "keyword(Salmonella)"]],
  ])("reads %j", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

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
  it.each([
    ["coli-K12", ["keyword(coli)", "keyword(K12)"]],
    ["H1N1/2009", ["keyword(H1N1)", "keyword(2009)"]],
    ["coli,salmonella", ["keyword(coli)", "keyword(salmonella)"]],
  ])("splits %j where Solr does", (text, expected) => {
    expect(clauses(text)).toEqual(expected);
  });

  it("keeps a word's parts together as one term", () => {
    expect(clauses("coli OR Salmonella-enterica")).toEqual([
      "or(keyword(coli),and(keyword(Salmonella),keyword(enterica)))",
    ]);
    expect(clauses("Escherichia -coli-K12")).toEqual([
      "keyword(Escherichia)",
      "not(and(keyword(coli),keyword(K12)))",
    ]);
  });

  it("keeps a pipe inside a word and drops a lone one", () => {
    expect(clauses('"fig|83332.12.peg.1" coli |')).toEqual([
      'keyword("fig|83332.12.peg.1")',
      "keyword(coli)",
    ]);
  });

  it("reads an operator word left by the syntax as a word", () => {
    expect(clauses("(OR) -NOT")).toEqual([
      'keyword("OR")',
      'not(keyword("NOT"))',
    ]);
  });

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
