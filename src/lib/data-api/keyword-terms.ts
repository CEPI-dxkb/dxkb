// No imports: the proxy's legacy-link redirect reads keyword terms too, and
// this keeps the resource registry out of its bundle.

/**
 * The terms of a keyword search: each quoted span, kept with its quotes and its
 * spaces collapsed (`"DNA polymerase"`) and with Solr's `-` exclusion when one
 * directly precedes it (`-"DNA polymerase"`), and each other
 * whitespace-separated word. A quote left open runs to the end of the text,
 * since Solr rejects an unbalanced quote (`TokenMgrError`) and the open phrase
 * is what the user is typing. Empty quotes are dropped.
 */
export function keywordTerms(keyword: string): string[] {
  return [...keyword.matchAll(/-?"[^"]*"?|[^\s"]+/g)].flatMap(([term]) => {
    const quote = term.indexOf('"');
    if (quote === -1) return [term];
    const phrase = term.slice(quote).replaceAll('"', "").trim().split(/\s+/).join(" ");
    return phrase ? [`${term.slice(0, quote)}"${phrase}"`] : [];
  });
}

/**
 * Characters that Solr reads as query syntax or the Data API rejects in a
 * `keyword(...)` clause, every one an HTTP 400 in some position: `:` names a
 * field, `[`, `{`, `^`, `\`, `&`, `/` and `%` start syntax, and the Data
 * API's RQL parser refuses `!`, `~`, `'` and an unbalanced parenthesis however
 * they are encoded. Solr's tokenizer splits a word at each of them anyway and
 * ANDs the parts (`keyword(coli-K12)` and `and(keyword(coli),keyword(K12))`
 * are both 1,666 genomes), so a word is read as its parts. Where Solr reads
 * one as syntax that works, this differs: a boost (`coli^2`), a range
 * (`<coli`) and a regular expression (`/col/`) are read as words. `*` and `?`
 * are left as the wildcards they are, and `|` as part of a word
 * (`"fig|83332.12.peg.1"`).
 */
const keywordSyntaxPattern = /[!~'()[\]{}:^\\&<>=%,+\-/]/g;
/** Solr's exclusion, a `-` that starts a word: `coli -Salmonella`. */
const exclusionPattern = /^-[^-]/;
const pipesPattern = /^\|+$/;
const operatorWords: ReadonlySet<string> = new Set(["AND", "OR", "NOT"]);
/**
 * What a search of only negations matches against: a group with no positive
 * term matches nothing once the Data API brackets it
 * (`and(eq(genome_id,*),and(not(keyword(coli)),not(keyword(Salmonella))))` is
 * 0 genomes, 16,837,798 with `keyword(*)` beside the NOTs, as alone).
 */
const anyKeyword = "keyword(*)";

/**
 * One term of a keyword search: a word, or a phrase with its quotes, as the
 * parts Solr ANDs (`coli-K12` is `coli` and `K12`; a phrase is one part).
 */
export interface KeywordTerm {
  parts: string[];
  negated: boolean;
}

/**
 * The parts of a word or quoted phrase, `keywordSyntaxPattern`'s characters
 * read as spaces. A part that is an operator word (`(OR)`) is quoted, since
 * Solr would read it as one; a part of only `|` is dropped.
 */
function termParts(term: string): string[] {
  if (term.startsWith('"')) {
    const phrase = keywordTerms(term.replace(keywordSyntaxPattern, " "));
    return phrase.length > 0 ? [`"${phrase.join(" ").replaceAll('"', "")}"`] : [];
  }
  return term
    .replace(keywordSyntaxPattern, " ")
    .split(/\s+/)
    .filter((part) => part !== "" && !pipesPattern.test(part))
    .map((part) => (operatorWords.has(part) ? `"${part}"` : part));
}

/**
 * A keyword search as the Data API should run it: an AND of groups, each group
 * the terms an `OR` joins (one term when there is no `OR`). Read the way legacy
 * BV-BRC's search box parses its text and Solr reads its operators:
 * - the terms are `keywordTerms` (words and quoted phrases), each read as its
 *   parts (`termParts`);
 * - `AND`, `OR` and `NOT` are operators in uppercase only, as in Solr (alpha's
 *   list keyword boxes send a lowercase `or` as the word it is), and so are
 *   Solr's `||` (OR) and a `-` that starts a word (NOT; `&&` is syntax read as
 *   a space, the implicit AND). `NOT` negates the next term, and `OR` joins the
 *   terms on either side and binds tighter than the implicit AND:
 *   `E coli OR Salmonella` is `E AND (coli OR Salmonella)`, 25,228 genomes.
 *   Legacy's parser also ORs every term after an `OR` (`a OR b c` as
 *   `a OR b OR c`); here `c` is ANDed;
 * - an operator with nothing to join (`coli OR`, a lone `NOT`) is dropped: as a
 *   clause of its own it is a Solr SyntaxError.
 * Text with no terms (blank, `""`, only syntax) is an empty search.
 */
export function keywordQuery(keyword: string): KeywordTerm[][] {
  const groups: KeywordTerm[][] = [];
  let joinsPrevious = false;
  let negated = false;
  for (const text of keywordTerms(keyword)) {
    if (text === "AND") joinsPrevious = false;
    else if (text === "OR" || text === "||") {
      joinsPrevious = groups.length > 0;
    } else if (text === "NOT") negated = true;
    else {
      const excluded = exclusionPattern.test(text);
      const parts = termParts(excluded ? text.slice(1) : text);
      if (parts.length === 0) continue;
      const term = { parts, negated: negated || excluded };
      if (joinsPrevious) groups[groups.length - 1].push(term);
      else groups.push([term]);
      joinsPrevious = false;
      negated = false;
    }
  }
  return groups;
}

/**
 * The RQL clauses of a `keywordQuery`, ANDed by the caller: one
 * `keyword(...)` per part, `and(...)` for a term's parts inside a `not(...)`
 * or an `or(...)`, `not(...)` for a negated term and `or(...)` for a group.
 * One clause per part, never Solr's own operators inside one clause: the Data
 * API joins a keyword's text into the surrounding query without brackets, so
 * `and(eq(genome_id,*),keyword(coli OR Salmonella))` lists all 17,033,311
 * genomes instead of the 195,658 the OR matches. A negation an `OR` offers,
 * and a search of only negations, match against `keyword(*)` (`anyKeyword`).
 * `encodeTerm` escapes a part's text for its RQL. `negatedOptions: "asSolr"`
 * leaves a negated OR option unanchored, as Solr reads one clause:
 * `or(keyword(coli),not(keyword(Salmonella)))` is coli AND NOT Salmonella,
 * 132,341 genomes, like `keyword(coli OR NOT Salmonella)`.
 */
export function keywordQueryClauses(
  groups: readonly (readonly KeywordTerm[])[],
  encodeTerm: (text: string) => string,
  negatedOptions: "anchored" | "asSolr" = "anchored",
): string[] {
  const partClauses = ({ parts }: KeywordTerm) =>
    parts.map((part) => `keyword(${encodeTerm(part)})`);
  const termClause = (term: KeywordTerm) => {
    const clauses = partClauses(term);
    return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
  };
  const clauses = groups.flatMap((group) => {
    if (group.length > 1) {
      const options = group.map((term) => {
        if (!term.negated) return termClause(term);
        const negation = `not(${termClause(term)})`;
        return negatedOptions === "anchored"
          ? `and(${anyKeyword},${negation})`
          : negation;
      });
      return [`or(${options.join(",")})`];
    }
    const [term] = group;
    return term.negated ? [`not(${termClause(term)})`] : partClauses(term);
  });
  const onlyNegations = groups.every(
    (group) => group.length === 1 && group[0].negated,
  );
  return onlyNegations && clauses.length > 0
    ? [anyKeyword, ...clauses]
    : clauses;
}
