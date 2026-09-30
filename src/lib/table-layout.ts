import { z } from "zod";

/**
 * A user's changes to one table's layout, stored per table in localStorage (see
 * useTableLayout). Only differences from the table's own defaults are kept, so a
 * column added to a profile later still shows with its default visibility, and ids
 * that no longer exist are ignored rather than breaking the table.
 */
export interface TableLayout {
  visibility?: Record<string, boolean>;
  order?: string[];
  widths?: Record<string, number>;
  facets?: Record<string, boolean>;
}

// Each field is validated on its own: one that is malformed (say a width outside
// 20-4000) reads as absent, so it can never cost the user the fields around it.
const tableLayoutSchema = z.object({
  visibility: z.record(z.string(), z.boolean()).optional().catch(undefined),
  order: z.array(z.string()).max(500).optional().catch(undefined),
  widths: z
    .record(z.string(), z.number().int().min(20).max(4000))
    .optional()
    .catch(undefined),
  facets: z.record(z.string(), z.boolean()).optional().catch(undefined),
});

const emptyTableLayout: TableLayout = {};

export function tableLayoutStorageKey(tableKey: string): string {
  return `dxkb-table-layout:v1:${tableKey}`;
}

export function parseTableLayout(raw: string | null): TableLayout {
  if (raw === null) return emptyTableLayout;
  try {
    const result = tableLayoutSchema.safeParse(JSON.parse(raw));
    if (!result.success) return emptyTableLayout;
    const { visibility, order, widths, facets } = result.data;
    return {
      ...(visibility && { visibility }),
      ...(order && { order }),
      ...(widths && { widths }),
      ...(facets && { facets }),
    };
  } catch {
    return emptyTableLayout;
  }
}

export function applyBooleanOverrides(
  defaults: Readonly<Record<string, boolean>>,
  overrides: Readonly<Record<string, boolean>> | undefined,
): Record<string, boolean> {
  const result = { ...defaults };
  for (const [id, value] of Object.entries(overrides ?? {})) {
    if (Object.hasOwn(defaults, id)) result[id] = value;
  }
  return result;
}

export function diffBooleanOverrides(
  defaults: Readonly<Record<string, boolean>>,
  next: Readonly<Record<string, boolean>>,
): Record<string, boolean> | undefined {
  const diff = Object.fromEntries(
    Object.entries(next).filter(
      ([id, value]) => Object.hasOwn(defaults, id) && defaults[id] !== value,
    ),
  );
  return Object.keys(diff).length > 0 ? diff : undefined;
}

export function applyColumnOrder(
  defaultOrder: readonly string[],
  saved: readonly string[] | undefined,
): string[] {
  if (!saved) return [...defaultOrder];
  const known = new Set(defaultOrder);
  const kept = saved.filter((id) => known.has(id));
  const keptIds = new Set(kept);
  return [...kept, ...defaultOrder.filter((id) => !keptIds.has(id))];
}

export function sameOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((id, index) => right[index] === id)
  );
}
