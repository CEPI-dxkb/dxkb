/** InterPro's tables write a lone "-" for a missing `interpro_id`, `interpro_description`, `description` and `e_value` (34% of the docs), so a `||` fallback chain never moves past it. */
export function cleanProteinFeatureValue(value: unknown): string {
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  return text === "-" ? "" : text;
}
