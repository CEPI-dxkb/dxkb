/**
 * Browser side of the Taxa Tree boundary. Kept separate from
 * `./taxonomy-tree.ts` for the same reason `./client.ts` is kept separate from
 * `./repository.ts`: the server module pulls in the resource registry and
 * every Zod schema, none of which belongs in a client bundle.
 *
 * Both calls are same-origin and credentialed, so the upstream Data API URL
 * and the BV-BRC token stay server-side. No environment variable is read here;
 * a `NEXT_PUBLIC_*` base URL would be inlined at build time and could never be
 * redirected at runtime.
 */
export const taxonomyTreeBasePath = "/api/taxonomy-tree";

/**
 * The route's `{error, code}` body carries the specific failure — a malformed
 * facet payload, an upstream message, a rejected parent id. Use it verbatim so
 * a specific diagnosis is never replaced by a generic one, and fall back to the
 * status line only when there is no JSON body to read (an aborted response, a
 * proxy error page).
 */
async function failureDetail(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  const error =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown }).error
      : undefined;
  return typeof error === "string" && error.trim() !== ""
    ? error
    : `${String(response.status)} ${response.statusText}`;
}

export class TaxonomyTreeRepository {
  constructor(private readonly basePath = taxonomyTreeBasePath) {}

  /** Every child of one taxon node, already paged and validated server-side. */
  async children(
    parentId: number,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>[]> {
    const response = await fetch(
      `${this.basePath}/children?parentId=${String(parentId)}`,
      { credentials: "include", signal },
    );
    if (!response.ok) {
      throw new Error(
        `taxonomy children ${String(parentId)}: ${await failureDetail(response)}`,
      );
    }
    const payload: unknown = await response.json();
    const rows =
      payload && typeof payload === "object"
        ? (payload as { rows?: unknown }).rows
        : undefined;
    if (!Array.isArray(rows)) {
      throw new Error(
        `taxonomy children ${String(parentId)}: response has no rows array`,
      );
    }
    return rows as Record<string, unknown>[];
  }

  /**
   * Child counts for a batch of parents. Returns an empty map without a
   * request when given no ids — the tree calls this with whatever collapsed
   * nodes are on screen, which is legitimately none on first paint.
   */
  async childCounts(
    parentIds: number[],
    signal?: AbortSignal,
  ): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (parentIds.length === 0) return counts;

    const params = new URLSearchParams();
    for (const parentId of parentIds)
      params.append("parentId", String(parentId));
    const response = await fetch(
      `${this.basePath}/child-counts?${params.toString()}`,
      { credentials: "include", signal },
    );
    if (!response.ok) {
      throw new Error(`taxonomy child counts: ${await failureDetail(response)}`);
    }
    const payload: unknown = await response.json();
    const raw =
      payload && typeof payload === "object"
        ? (payload as { counts?: unknown }).counts
        : undefined;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("taxonomy child counts: response has no counts object");
    }
    for (const [id, count] of Object.entries(raw)) {
      const parentId = Number(id);
      if (!Number.isInteger(parentId) || parentId <= 0)
        throw new Error(`taxonomy child counts: invalid parent id ${id}`);
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0)
        throw new Error(
          `taxonomy child counts: invalid child count ${String(count)}`,
        );
      counts.set(parentId, count);
    }
    return counts;
  }
}
