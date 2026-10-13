import { strainRecordSchema } from "@/lib/data-api";
import { z } from "zod";

const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const strainViewRecordSchema = strainRecordSchema.extend({
  taxon_id: scalar.optional(),
  taxon_lineage_ids: z.union([scalar, z.array(scalar)]).optional(),
  family: z.string().optional(),
  genus: z.string().optional(),
  species: z.string().optional(),
  subtype: z.string().optional(),
  h_type: scalar.optional(),
  n_type: scalar.optional(),
  segment_count: scalar.optional(),
  status: z.string().optional(),
  season: z.string().optional(),
  host_group: z.string().optional(),
  host_common_name: z.string().optional(),
  host_name: z.string().optional(),
  lab_host: z.string().optional(),
  passage: z.string().optional(),
  geographic_group: z.string().optional(),
  isolation_country: z.string().optional(),
  collection_year: scalar.optional(),
  collection_date: z.string().optional(),
  date_inserted: z.string().optional(),
});

export type StrainViewRecord = z.infer<typeof strainViewRecordSchema>;

/** A Strain record `id` (a UUID upstream), not the phrase-matched strain name. */
export function isStrainId(value: string): boolean {
  return value.length > 0 && value.length <= 1_000;
}
