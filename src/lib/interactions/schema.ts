import { z } from "zod";
import { ppiRecordSchema } from "@/lib/data-api";

const optionalText = z.string().optional();
const optionalTextList = z.union([z.string(), z.array(z.string())]).optional();

/**
 * The gateway only guarantees `id`; the graph needs both endpoints, since a row missing one would
 * become a node keyed `undefined` and collapse into one phantom node.
 */
export const ppiGraphRecordSchema = ppiRecordSchema.extend({
  interactor_a: z.string().min(1),
  interactor_b: z.string().min(1),
  interactor_type_a: optionalText,
  interactor_type_b: optionalText,
  interactor_desc_a: optionalText,
  interactor_desc_b: optionalText,
  feature_id_a: optionalText,
  feature_id_b: optionalText,
  gene_a: optionalText,
  gene_b: optionalText,
  genome_name_a: optionalText,
  genome_name_b: optionalText,
  refseq_locus_tag_a: optionalText,
  refseq_locus_tag_b: optionalText,
  domain_a: optionalText,
  domain_b: optionalText,
  evidence: optionalTextList,
  interaction_type: optionalTextList,
  detection_method: optionalTextList,
});

export type PpiRecord = z.infer<typeof ppiGraphRecordSchema>;
