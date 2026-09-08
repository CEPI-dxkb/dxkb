import { z } from "zod";

const scalar = z.union([z.string(), z.number()]);
const stringList = z.union([z.string(), z.array(z.string())]);
const scalarList = z.union([scalar, z.array(scalar)]);
const experimentIdSchema = z
  .string()
  .max(1_000)
  .regex(/^(?=.*[1-9])\d+$/);

export const experimentViewRecordSchema = z.looseObject({
  exp_id: experimentIdSchema,
  study_name: z.string().optional(),
  study_title: z.string().optional(),
  study_description: z.string().optional(),
  study_pi: z.string().optional(),
  study_institution: z.string().optional(),
  exp_name: z.string().optional(),
  exp_title: z.string().optional(),
  exp_description: z.string().optional(),
  exp_poc: z.string().optional(),
  experimenters: stringList.optional(),
  public_repository: z.string().optional(),
  public_identifier: z.string().optional(),
  pmid: scalar.optional(),
  exp_type: z.string().optional(),
  measurement_technique: z.string().optional(),
  organism: stringList.optional(),
  strain: stringList.optional(),
  taxon_id: scalarList.optional(),
  taxon_lineage_ids: scalarList.optional(),
  treatment_type: stringList.optional(),
  treatment_name: stringList.optional(),
  treatment_amount: stringList.optional(),
  treatment_duration: stringList.optional(),
  samples: scalar.optional(),
  biosets: scalar.optional(),
  genome_id: stringList.optional(),
  date_inserted: z.string().optional(),
  additional_metadata: z.unknown().optional(),
});

export const biosetViewRecordSchema = z.looseObject({
  bioset_id: z.string().min(1),
  exp_id: experimentIdSchema,
  bioset_name: z.string().optional(),
  bioset_description: z.string().optional(),
  bioset_type: z.string().optional(),
  organism: z.string().optional(),
});

export type ExperimentViewRecord = z.infer<typeof experimentViewRecordSchema>;
export type BiosetViewRecord = z.infer<typeof biosetViewRecordSchema>;

export function isExperimentId(value: string): boolean {
  return experimentIdSchema.safeParse(value).success;
}
