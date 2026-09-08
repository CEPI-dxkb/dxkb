import { z } from "zod";
import { taxonomyRecordSchema } from "@/lib/data-api";

export const taxonomyViewRecordSchema = taxonomyRecordSchema;
export type TaxonomyViewRecord = z.infer<typeof taxonomyViewRecordSchema>;

export function isTaxonId(value: unknown): value is string {
  return typeof value === "string" && /^(?=.*[1-9])\d+$/.test(value);
}
