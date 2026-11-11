/** Clears module-level account caches (outside TanStack Query) on account change; modules register on load so auth paths do not import each cache. */
const accountCacheClears = new Set<() => void>();

export function registerAccountCacheClear(clear: () => void): void {
  accountCacheClears.add(clear);
}

export function clearAccountCaches(): void {
  for (const clear of accountCacheClears) clear();
}
