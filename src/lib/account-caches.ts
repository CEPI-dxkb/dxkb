/**
 * Account-change invalidation for module-level caches that hold one account's
 * data outside TanStack Query, so `queryClient.clear()` does not reach them.
 * A module holding such a cache registers its clear function here when it
 * loads; every account change (sign-in, sign-up, impersonation, sign-out)
 * calls `clearAccountCaches()` beside `queryClient.clear()`.
 *
 * Registration rather than a direct import keeps the account-change paths
 * (the auth provider, the sign-out button, the command palette, which every
 * route loads) from pulling each cache's module into the shared bundle. A
 * module that was never loaded holds nothing to clear, so this is complete by
 * construction.
 */
const accountCacheClears = new Set<() => void>();

export function registerAccountCacheClear(clear: () => void): void {
  accountCacheClears.add(clear);
}

export function clearAccountCaches(): void {
  for (const clear of accountCacheClears) clear();
}
