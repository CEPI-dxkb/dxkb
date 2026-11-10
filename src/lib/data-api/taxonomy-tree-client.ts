/**
 * Browser side of the Taxa Tree boundary, separate from `./taxonomy-tree.ts` so
 * the resource registry and Zod schemas stay out of the client bundle.
 * Calls are same-origin, so the upstream URL and token stay server-side.
 */
import { httpFailure } from "./route-failure-client";

export const taxonomyTreeBasePath = "/api/taxonomy-tree";

export class TaxonomyTreeRepository {
  constructor(private readonly basePath = taxonomyTreeBasePath) {}

  async children(
    parentId: number,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>[]> {
    const response = await fetch(
      `${this.basePath}/children?parentId=${String(parentId)}`,
      { credentials: "include", signal },
    );
    if (!response.ok) {
      throw await httpFailure(response, `taxonomy children ${String(parentId)}`);
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
   * Returns an empty map without a request when given no ids, which is
   * legitimate on first paint.
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
      throw await httpFailure(response, "taxonomy child counts");
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
