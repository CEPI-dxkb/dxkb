/**
 * Page size for every resource collection. The URL-owned collection state
 * itself lives in `@/lib/views/collection-state` and is imported from there
 * directly — this module deliberately does not re-export it. It used to, and
 * the re-export was the only reason several of that module's exports looked
 * reachable from the app when nothing imported them.
 */
export const resourceCollectionPageSize = 200;
