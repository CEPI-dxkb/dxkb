/**
 * Removes quotes that cannot delimit a phrase and closes an open final phrase,
 * as `keywordTerms` does. Legacy's parser assigns on an opening quote, so a
 * mid-token quote discards the text before it.
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

/** Quoted spans are matched first so their words stay. */
const operatorWordPattern = /"[^"]*"|(?<=^|\s)(and|or|not)(?=\s+\S)/gi;

export function normalizeLegacyKeyword(keyword: string): string {
  let query = keyword.replace(/^\s+|\s+$/g, "");

  query = query.replace(/'/g, "").replace(/:/g, " ");
  query = query
    .replace(/\(\+\)/g, " ")
    .replace(/\(-\)/g, " ")
    .replace(/,|\+|-|=|<|>|\\|\//g, " ");

  // Runs after the substitutions above so punctuation turned into whitespace
  // counts as a token boundary.
  query = normalizeStrayQuotes(query);

  if (query.charAt(0) === '"' && query.match(/\(|\)|\[|\]|\{|\}/)) {
    query = query.replace(/"/g, "");
  }

  if (query.charAt(0) !== '"' || query.match(/\(|\)|\[|\]|\{|\}/)) {
    const keywords = query.split(/\s|\(|\)|\[|\]|\{|\}/);
    // Words inside a phrase are skipped: quoting an identifier there would
    // break the phrase apart.
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
