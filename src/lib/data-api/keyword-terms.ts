// No imports: the proxy's legacy-link redirect reads these terms, and this
// keeps the resource registry out of its bundle.

/**
 * An unbalanced quote runs to the end of the text, since Solr rejects it and
 * the open phrase is what the user is typing.
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
 * Characters Solr reads as query syntax or the Data API rejects in
 * `keyword(...)`, each an HTTP 400 somewhere. Solr splits a word at each and
 * ANDs the parts, so a word is read as its parts.
 * `*` and `?` stay wildcards and `|` stays part of a word.
 */
const keywordSyntaxPattern = /[!~'()[\]{}:^\\&<>=%,+\-/]/g;
const exclusionPattern = /^-[^-]/;
const pipesPattern = /^\|+$/;
const operatorWords: ReadonlySet<string> = new Set(["AND", "OR", "NOT"]);
/**
 * A search of only negations matches against `keyword(*)`, because the Data API
 * brackets a group with no positive term so it matches nothing.
 */
const anyKeyword = "keyword(*)";

export interface KeywordTerm {
  parts: string[];
  negated: boolean;
}

/**
 * An operator word part (`(OR)`) is quoted, since Solr would read it as one; a
 * part of only `|` is dropped.
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
 * AND, OR and NOT are operators in uppercase only, as in Solr; OR binds tighter
 * than the implicit AND (`E coli OR Salmonella` is `E AND (coli OR
 * Salmonella)`).
 * An operator with nothing to join is dropped, since alone it is a Solr
 * SyntaxError.
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
 * One clause per part, never Solr's operators inside one clause: the Data API
 * joins keyword text into the query without brackets, so `keyword(coli OR
 * Salmonella)` would match far more.
 * `negatedOptions: "asSolr"` leaves a negated OR option unanchored, as Solr
 * reads one clause.
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
