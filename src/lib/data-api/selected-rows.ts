import type { DataRepository } from "./client";
import type { DataResource } from "./types";
import { maxSelectedRows } from "./validation";

/**
 * Reads rows by id through the `selected` operation, in batches the gateway
 * accepts, and returns them in `ids` order. The id field is always requested,
 * since the order is restored from it. A `selected` read carries no scope,
 * keyword or filters: it is exactly the rows named.
 */
export async function fetchSelectedRows(
  repository: DataRepository,
  resource: DataResource,
  idField: string,
  ids: readonly string[],
  fields: readonly string[],
): Promise<Record<string, unknown>[]> {
  const requestFields = fields.includes(idField)
    ? [...fields]
    : [...fields, idField];
  const batches = await Promise.all(
    Array.from(
      { length: Math.ceil(ids.length / maxSelectedRows) },
      (_, index) =>
        repository.selected(resource, {
          ids: ids.slice(
            index * maxSelectedRows,
            (index + 1) * maxSelectedRows,
          ),
          fields: requestFields,
        }),
    ),
  );
  const orderById = new Map(ids.map((id, index) => [id, index]));
  return batches
    .flatMap((batch) => batch.rows)
    .sort(
      (left, right) =>
        (orderById.get(String(left[idField])) ?? Number.MAX_VALUE) -
        (orderById.get(String(right[idField])) ?? Number.MAX_VALUE),
    );
}
