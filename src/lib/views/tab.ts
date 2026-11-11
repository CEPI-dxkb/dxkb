export function resolveTab(
  requested: string | string[] | undefined,
  validTabs: readonly string[],
  defaultTab: string,
): string {
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (value && validTabs.includes(value)) return value;
  return defaultTab;
}
