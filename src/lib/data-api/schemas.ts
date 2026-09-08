import { z } from "zod";

const identifier = z.string().min(1);
const stringOrNumber = z.union([z.string(), z.number()]);
const stringList = z.union([z.string(), z.array(z.string())]);
const scalarList = z.union([stringOrNumber, z.array(stringOrNumber)]);
const optionalTaxonomy = {
  taxon_id: stringOrNumber.optional(),
  taxon_lineage_ids: z
    .union([z.array(stringOrNumber), stringOrNumber])
    .optional(),
};

export const genomeRecordSchema = z.looseObject({
  genome_id: identifier,
  genome_name: z.string().optional(),
  strain: z.string().optional(),
  ...optionalTaxonomy,
  genome_length: stringOrNumber.optional(),
  contigs: stringOrNumber.optional(),
  patric_cds: stringOrNumber.optional(),
});

export const genomeFeatureRecordSchema = z.looseObject({
  feature_id: identifier,
  patric_id: z.string().optional(),
  genome_id: z.string().optional(),
  ...optionalTaxonomy,
});

export const epitopeRecordSchema = z.looseObject({
  epitope_id: identifier,
  epitope_type: z.string().optional(),
  epitope_sequence: z.string().optional(),
  organism: z.string().optional(),
  ...optionalTaxonomy,
  taxon_lineage_names: z.union([z.string(), z.array(z.string())]).optional(),
  protein_name: z.string().optional(),
  protein_id: z.string().optional(),
  protein_accession: z.string().optional(),
  start: stringOrNumber.optional(),
  end: stringOrNumber.optional(),
  host_name: z.union([z.string(), z.array(z.string())]).optional(),
  total_assays: stringOrNumber.optional(),
  assay_results: z.union([z.string(), z.array(z.string())]).optional(),
  bcell_assays: stringOrNumber.optional(),
  tcell_assays: stringOrNumber.optional(),
  mhc_assays: stringOrNumber.optional(),
  comments: z.union([z.string(), z.array(z.string())]).optional(),
  date_inserted: z.string().optional(),
});

export const epitopeAssayRecordSchema = z.looseObject({
  assay_id: identifier,
  epitope_id: z.string().optional(),
  assay_type: z.string().optional(),
  assay_method: z.string().optional(),
  assay_group: z.string().optional(),
  assay_result: z.string().optional(),
  host_name: z.string().optional(),
  pmid: stringOrNumber.optional(),
  title: z.string().optional(),
  protein_name: z.string().optional(),
  epitope_type: z.string().optional(),
});

export const surveillanceRecordSchema = z.looseObject({
  id: identifier,
  ...optionalTaxonomy,
  sample_identifier: z.string().optional(),
  pathogen_test_type: z.array(z.string()).optional(),
});

export const serologyRecordSchema = z.looseObject({
  id: identifier,
  ...optionalTaxonomy,
  sample_identifier: z.string().optional(),
  test_type: z.string().optional(),
});

const strainAccessions = {
  genome_ids: z.array(z.string()).optional(),
  genbank_accessions: z.array(z.string()).optional(),
  "1_pb2": z.array(z.string()).optional(),
  "2_pb1": z.array(z.string()).optional(),
  "3_pa": z.array(z.string()).optional(),
  "4_ha": z.array(z.string()).optional(),
  "5_np": z.array(z.string()).optional(),
  "6_na": z.array(z.string()).optional(),
  "7_mp": z.array(z.string()).optional(),
  "8_ns": z.array(z.string()).optional(),
  s: z.array(z.string()).optional(),
  m: z.array(z.string()).optional(),
  l: z.array(z.string()).optional(),
  other_segments: z.array(z.string()).optional(),
};

export const strainRecordSchema = z.looseObject({
  id: identifier,
  strain: z.string().optional(),
  taxon_lineage_names: z.union([z.string(), z.array(z.string())]).optional(),
  ...strainAccessions,
  ...optionalTaxonomy,
});

export const proteinFeatureRecordSchema = z.looseObject({
  id: identifier,
  feature_id: z.string().optional(),
  genome_id: z.string().optional(),
  ...optionalTaxonomy,
});

export const proteinStructureRecordSchema = z.looseObject({
  pdb_id: identifier,
  title: z.string().optional(),
  organism_name: stringList.optional(),
  taxon_id: scalarList.optional(),
  taxon_lineage_ids: scalarList.optional(),
  taxon_lineage_names: stringList.optional(),
  genome_id: z.string().optional(),
  patric_id: z.string().optional(),
  uniprotkb_accession: stringList.optional(),
  gene: stringList.optional(),
  product: stringList.optional(),
  sequence_md5: stringList.optional(),
  sequence: z.string().optional(),
  alignments: z.unknown().optional(),
  method: stringList.optional(),
  resolution: stringOrNumber.optional(),
  pmid: scalarList.optional(),
  institution: stringList.optional(),
  authors: stringList.optional(),
  release_date: z.string().optional(),
  file_path: z.string().optional(),
  date_inserted: z.string().optional(),
});

export const experimentRecordSchema = z.looseObject({
  exp_id: identifier.regex(/^(?=.*[1-9])\d+$/),
  genome_id: stringList.optional(),
  taxon_id: scalarList.optional(),
  taxon_lineage_ids: scalarList.optional(),
});

export const biosetRecordSchema = z.looseObject({
  bioset_id: identifier,
  exp_id: z.string().optional(),
});

export const genomeSequenceRecordSchema = z.looseObject({
  sequence_id: identifier,
  genome_id: z.string().optional(),
  ...optionalTaxonomy,
});

export const ppiRecordSchema = z.looseObject({
  id: identifier,
});
