import { z } from "zod";

const identifier = z.union([z.string().min(1), z.number()]);
const scalar = z.union([z.string(), z.number(), z.boolean()]);
const stringList = z.union([z.string(), z.array(z.string())]);

export const serologyViewRecordSchema = z.looseObject({
  id: identifier,
  taxon_lineage_ids: z.union([scalar, z.array(scalar)]).optional(),
  sample_identifier: z.string().min(1),
  test_type: z.string().min(1).optional(),
  test_result: z.string().optional(),
  test_interpretation: z.string().optional(),
  serotype: stringList.optional(),
  collection_date: z.string().optional(),
  collection_year: scalar.optional(),
  date_inserted: z.string().optional(),
  date_modified: z.string().optional(),
  comments: stringList.optional(),
});

export type SerologyViewRecord = z.infer<typeof serologyViewRecordSchema>;

export function isSerologySampleId(value: string): boolean {
  return value.length > 0 && value.length <= 1_000;
}

export function formatSerologyDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  if (!month) return year;
  if (!day) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}
