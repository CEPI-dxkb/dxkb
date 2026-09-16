function encodeRqlField(val: string) {
  return encodeURIComponent(val);
}

function encodeRqlValue(val: string) {
  return encodeURIComponent(val)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    ;
}

interface RqlFilter {
  op: string;
  field: string;
  value: string | [string, string];
}

/**
 * Build the legacy Search filter bar's RQL predicate from its selected facets
 * and keywords. Values are percent-encoded so a comma or parenthesis inside a
 * facet value cannot be read as RQL syntax.
 *
 * Values are **not** quoted here. The predicate is sent to the same-origin Data
 * API gateway as `rql`, where `validateRql` re-serializes it and quotes any
 * value that needs it (`serializeRql`/`serializeValue` in
 * `src/lib/data-api/rql.ts` quote on whitespace, and always for the phrase
 * fields). Quoting here as well — which this used to do by wrapping eq() values
 * in `%22` — produced a value whose *content* was a quoted string, so Solr
 * matched on the quote characters instead of the phrase.
 */
export function buildRql({ selected, keywords }: { selected: RqlFilter[]; keywords: string[] }) {
  const parts: string[] = [];
  const grouped = new Map<string, string[]>();

  selected.forEach((f) => {
    const expr =
      f.op === "between"
        ? `between(${encodeRqlField(f.field)},${encodeRqlValue((f.value as [string, string])[0])},${encodeRqlValue((f.value as [string, string])[1])})`
        : `${f.op}(${encodeRqlField(f.field)},${encodeRqlValue(String(f.value))})`;

    const bucket = grouped.get(f.field) ?? [];
    bucket.push(expr);
    grouped.set(f.field, bucket);
  });

  grouped.forEach((arr) => {
    parts.push(arr.length === 1 ? arr[0] : `or(${arr.join(",")})`);
  });

  if (keywords.length) {
    const kw = keywords.map((k) => {
      const raw = `${k}*`;
      const encoded = encodeRqlValue(raw);
      return `keyword(${encoded})`;
    });

    parts.push(kw.length === 1 ? kw[0] : `and(${kw.join(",")})`);
  }

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];

  return `and(${parts.join(",")})`;
}

/**
 * Conjoin RQL clauses into one predicate, dropping empty ones. Two or more
 * clauses become `and(...)`: the Data API gateway parses `rql` as a single RQL
 * expression, so the legacy `&`-separated form it replaces is rejected there.
 */
export function combineRql(...clauses: (string | undefined)[]): string {
  const parts = clauses.filter((clause) => Boolean(clause));
  if (parts.length <= 1) return parts[0] ?? "";
  return `and(${parts.join(",")})`;
}
