/**
 * Remove quotes that cannot act as phrase delimiters, and close the phrase left
 * open at the end of the text.
 *
 * WHY: legacy's parser (`searchToQuery`) treats every `\"` as a delimiter, and
 * its opening-quote branch *assigns* instead of appending, so a quote in the
 * middle of a token discards everything before it; a quote left open reaches
 * Solr, which rejects it. `?keyword=` reads its terms with `keywordTerms`
 * instead, which splits at an embedded quote and closes an open one; quotes
 * that cannot delimit a phrase are removed here so the text says what it
 * searches, and the last phrase left open is closed as `keywordTerms` would
 * close it, the phrase being typed.
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

  // The last opener left open, when no phrase follows it, runs to the end.
  const openPhrase = openingQuotes.at(-1);
  const closesAtEnd =
    openPhrase !== undefined &&
    ![...pairedQuotes].some((index) => index > openPhrase);
  if (closesAtEnd) pairedQuotes.add(openPhrase);

  let normalized = "";
  for (let index = 0; index < query.length; index++) {
    if (query[index] !== '"' || pairedQuotes.has(index)) {
      normalized += query[index];
    }
  }
  return closesAtEnd ? `${normalized.trimEnd()}"` : normalized;
}

/**
 * Legacy's parser (`searchToQuery`) reads `and`, `or` and `not` in any case as
 * operators, but only before another word; `?keyword=` reads Solr's uppercase
 * ones (`keywordQuery`). Quoted spans are matched first so their words stay.
 */
const operatorWordPattern = /"[^"]*"|(?<=^|\s)(and|or|not)(?=\s+\S)/gi;

/**
 * Normalize text typed into the search bar the way legacy BV-BRC's search box
 * (`GlobalSearch.processQuery`) does, as the `?keyword=` text that searches
 * what alpha's search box searches.
 */
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
    // Legacy also quotes an identifier inside a phrase (`kinase "EC 2.1.1.1
    // enzyme"`), which breaks the phrase apart; words inside one are skipped.
    let inPhrase = false;
    for (let index = 0; index < keywords.length; index++) {
      const word = keywords[index];
      if (
        !inPhrase &&
        word.charAt(0) !== '"' &&
        word.charAt(word.length - 1) !== '"' &&
        (word.match(/^fig\|[0-9]+/) !== null ||
          word.match(/[0-9]+\.[0-9]+/) !== null ||
          word.match(/[0-9]+$/) !== null)
      ) {
        keywords[index] = `"${word}"`;
      }
      if (!inPhrase && word.startsWith('"')) {
        inPhrase = word.length === 1 || !word.endsWith('"');
      } else if (inPhrase && word.endsWith('"')) {
        inPhrase = false;
      }
    }
    query = keywords.join(" ");
  }

  return query
    .trim()
    .replace(operatorWordPattern, (match, operator?: string) =>
      operator ? operator.toUpperCase() : match,
    );
}
