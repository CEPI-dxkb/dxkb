export function buildRql({ selected, keywords }) {
  const parts: string[] = [];

  const grouped: Record<string, string[]> = {};

  selected.forEach((f) => {
    const expr =
      f.op === 'between'
        ? `between(${f.field},${f.value[0]},${f.value[1]})`
        : `${f.op}(${f.field},${f.value})`;

    if (!grouped[f.field]) grouped[f.field] = [];
    grouped[f.field].push(expr);
  });

  Object.values(grouped).forEach((arr) => {
    parts.push(arr.length === 1 ? arr[0] : `or(${arr.join(',')})`);
  });

  if (keywords.length) {
    const kw = keywords.map((k) => `keyword(${k}*)`);
    parts.push(kw.length === 1 ? kw[0] : `and(${kw.join(',')})`);
  }

  if (!parts.length) return 'false';
  if (parts.length === 1) return parts[0];

  return `and(${parts.join(',')})`;
}