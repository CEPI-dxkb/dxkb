/** Normalize a legacy global-search keyword for the Solr query parser. */
export function normalizeLegacyKeyword(keyword: string): string {
  let query = keyword.replace(/^\s+|\s+$/g, "");

  query = query.replace(/'/g, "").replace(/:/g, " ");
  query = query
    .replace(/\(\+\)/g, " ")
    .replace(/\(-\)/g, " ")
    .replace(/,|\+|-|=|<|>|\\|\//g, " ");

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
