function countQuotes(value: string): number {
  return (value.match(/"/g) ?? []).length;
}

/**
 * Remove quotes that cannot act as phrase delimiters.
 *
 * WHY: `searchToQuery`'s parser treats every `"` as a delimiter, and its
 * opening-quote branch *assigns* instead of appending (`state.exp = '"'`),
 * so a quote in the middle of a token discards everything accumulated before
 * it — `foo"bar` searches for `"bar` and silently loses `foo`. An unterminated
 * quote is just as bad: the `"` survives into the emitted `keyword()` term and
 * Solr is asked to match a literal quote character. Fixing the parser would
 * change the parse for every one of its callers, so the stray quotes are
 * removed here, before the string ever reaches it.
 *
 * Balanced quotes sitting at token boundaries are genuine phrase delimiters
 * and are preserved, so `"EC 2.1.1.1"` still searches as a single phrase.
 */
function normalizeStrayQuotes(query: string): string {
  const quoteCount = countQuotes(query);
  if (quoteCount === 0) return query;

  // Odd count: at least one quote can never be matched, so none of them can be
  // trusted as a delimiter.
  if (quoteCount % 2 === 1) return query.replace(/"/g, "");

  // Even count: drop only the quotes wedged inside a token (non-whitespace on
  // both sides). That can orphan a partner quote, so re-check the parity.
  // The preceding character is captured rather than matched with a lookbehind
  // because `tsconfig.json` targets ES2017.
  const withoutEmbedded = query.replace(/(\S)"(?=\S)/g, "$1");
  return countQuotes(withoutEmbedded) % 2 === 0
    ? withoutEmbedded
    : withoutEmbedded.replace(/"/g, "");
}

/** Normalize a legacy global-search keyword for the Solr query parser. */
export function normalizeLegacyKeyword(keyword: string): string {
  let query = keyword.replace(/^\s+|\s+$/g, "");

  query = query.replace(/'/g, "").replace(/:/g, " ");
  query = query
    .replace(/\(\+\)/g, " ")
    .replace(/\(-\)/g, " ")
    .replace(/,|\+|-|=|<|>|\\|\//g, " ");

  // Runs after the substitutions above so that punctuation already turned into
  // whitespace counts as a token boundary rather than as a token character.
  query = normalizeStrayQuotes(query);

  if (query.charAt(0) === '"' && query.match(/\(|\)|\[|\]|\{|\}/)) {
    query = query.replace(/"/g, "");
  }

  if (query.charAt(0) !== '"' || query.match(/\(|\)|\[|\]|\{|\}/)) {
    const keywords = query.split(/\s|\(|\)|\[|\]|\{|\}/);
    for (let index = 0; index < keywords.length; index++) {
      if (
        keywords[index].charAt(0) !== '"' &&
        keywords[index].charAt(keywords[index].length - 1) !== '"' &&
        (keywords[index].match(/^fig\|[0-9]+/) !== null ||
          keywords[index].match(/[0-9]+\.[0-9]+/) !== null ||
          keywords[index].match(/[0-9]+$/) !== null)
      ) {
        keywords[index] = `"${keywords[index]}"`;
      }
    }
    query = keywords.join(" ");
  }

  return query.trim();
}
