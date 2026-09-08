import type { SearchParamsRecord } from "./rql";

/**
 * Return the first value of a search param, narrowing the `string | string[] |
 * undefined` shape Next.js hands route components to a single `string | undefined`.
 */
export function firstSearchParam(
  params: SearchParamsRecord | undefined,
  key: string,
): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function canonicalizeMemberTabQuery(
  params: SearchParamsRecord,
  activeTab: string,
  defaultTab = "overview",
): string | null {
  const requestedTab = firstSearchParam(params, "tab");
  const canonicalTab = activeTab === defaultTab ? undefined : activeTab;
  if (requestedTab === canonicalTab && !Array.isArray(params.tab)) return null;

  const next = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === "tab" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      next.append(name, item);
    }
  }
  if (canonicalTab) next.set("tab", canonicalTab);
  return next.toString();
}
