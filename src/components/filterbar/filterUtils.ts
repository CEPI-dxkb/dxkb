function encodeRqlField(val: string) {
  return encodeURIComponent(val);
}

function encodeRqlValue(val: string) {
  return encodeURIComponent(`"${val}"`)
    //.replace(/\(/g, '%28')
    //.replace(/\)/g, '%29')
    ;
}

export function buildRql({ selected, keywords }) {
  const parts: string[] = [];
  const grouped: Record<string, string[]> = {};

  selected.forEach((f) => {
    const expr =
      f.op === 'between'
        ? `between(${encodeRqlField(f.field)},${encodeRqlValue(f.value[0])},${encodeRqlValue(f.value[1])})`
        : `${f.op}(${encodeRqlField(f.field)},${encodeRqlValue(String(f.value))})`;

    if (!grouped[f.field]) grouped[f.field] = [];
    grouped[f.field].push(expr);
  });

  Object.values(grouped).forEach((arr) => {
    parts.push(arr.length === 1 ? arr[0] : `or(${arr.join(',')})`);
  });

  if (keywords.length) {
    const kw = keywords.map((k) => `keyword(${encodeRqlValue(k)}*)`);
    parts.push(kw.length === 1 ? kw[0] : `and(${kw.join(',')})`);
  }

  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];

  return `and(${parts.join(',')})`;
}