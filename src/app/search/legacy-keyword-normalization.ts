/**
 * Remove quotes that cannot act as phrase delimiters.
 *
 * WHY: `searchToQuery`'s parser treats every `\"` as a delimiter, and its
 * opening-quote branch *assigns* instead of appending (`state.exp = '\"'`),
 * so a quote in the middle of a token discards everything accumulated before
 * it. Unmatched quotes can likewise survive into a `keyword()` term. Fixing the
 * parser would change every caller, so unusable quotes are removed here.
 *
 * A phrase opener must begin a token and its closer must end one. Pairing those
 * delimiters individually preserves valid phrases even when another quote is
 * embedded or unmatched.
 */
function normalizeStrayQuotes(query: string): string {
  const openingQuotes: number[] = [];
  const pairedQuotes = new Set<number>();

  for (let index = 0; index < query.length; index++) {
    if (query[index] !== '"') continue;

    const isFirstCharacter = index === 0;
    const isLastCharacter = index === query.length - 1;
    const canOpen =
      (isFirstCharacter || /\s/.test(query[index - 1])) &&
      !isLastCharacter &&
      !/\s/.test(query[index + 1]);
    const canClose =
      !isFirstCharacter &&
      !/\s/.test(query[index - 1]) &&
      (isLastCharacter || /\s/.test(query[index + 1]));

    if (canClose && openingQuotes.length > 0) {
      const openingQuote = openingQuotes.pop();
      if (openingQuote !== undefined) pairedQuotes.add(openingQuote);
      pairedQuotes.add(index);
    } else if (canOpen) {
      openingQuotes.push(index);
    }
  }

  let normalized = "";
  for (let index = 0; index < query.length; index++) {
    if (query[index] !== '"' || pairedQuotes.has(index)) {
      normalized += query[index];
    }
  }
  return normalized;
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
