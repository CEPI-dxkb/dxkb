import { z } from "zod";

// Sequence type enum for viral genome tree (genome groups and FASTA files)
export const viralGenomeSequenceTypeSchema = z.enum([
  "genome_group",
  "aligned_dna_fasta",
  "feature_dna_fasta",
]);

// Sequence item schema
export const viralGenomeSequenceItemSchema = z.object({
  filename: z.string().min(1, "Sequence path is required"),
  type: viralGenomeSequenceTypeSchema,
});

// Main form schema
export const viralGenomeTreeFormSchema = z
  .object({
    recipe: z.enum(["RAxML", "PhyML", "FastTree"], {
      required_error: "Recipe must be selected",
    }),
    substitution_model: z.string().min(1, "Substitution model is required"),
    trim_threshold: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 1;
        },
        {
          message: "Trim threshold must be a number between 0 and 1",
        },
      ),
    gap_threshold: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 1;
        },
        {
          message: "Gap threshold must be a number between 0 and 1",
        },
      ),
    sequences: z
      .array(viralGenomeSequenceItemSchema)
      .min(1, "At least one sequence must be selected")
      .max(5000, "Maximum of 5000 sequences allowed"),
    metadata_fields: z.array(z.string()).optional(),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validate substitution model (DNA models only for genomes)
    const dnaModels = ["GTR", "TN93", "HKY85", "F84", "F81", "K80", "JC69"];

    if (!dnaModels.includes(data.substitution_model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Substitution model ${data.substitution_model} is not valid for genome sequences`,
        path: ["substitution_model"],
      });
    }
  });

export type ViralGenomeTreeFormData = z.infer<typeof viralGenomeTreeFormSchema>;
export type ViralGenomeSequenceItem = z.infer<typeof viralGenomeSequenceItemSchema>;

// Constants
export const MAX_SEQUENCES = 5000;

export const DNA_MODELS = [
  { value: "GTR", label: "GTR" },
  { value: "TN93", label: "TN93" },
  { value: "HKY85", label: "HKY85" },
  { value: "F84", label: "F84" },
  { value: "F81", label: "F81" },
  { value: "K80", label: "K80" },
  { value: "JC69", label: "JC69" },
] as const;

export const THRESHOLD_OPTIONS = [
  "0",
  "0.1",
  "0.2",
  "0.3",
  "0.4",
  "0.5",
  "0.6",
  "0.7",
  "0.8",
  "0.9",
  "1.0",
] as const;

export const DEFAULT_METADATA_FIELDS = [
  { id: "genome_id", name: "Genome ID", selected: true },
  { id: "genome_name", name: "Genome Name", selected: true },
  { id: "species", name: "Species", selected: true },
  { id: "strain", name: "Strain", selected: true },
  { id: "accession", name: "Accession", selected: true },
  { id: "subtype", name: "Subtype", selected: true },
];

// Metadata field item type
export interface GenomeMetadataFieldItem {
  field: string;
  displayName?: string;
  isLabel?: boolean;
}

// Genome metadata fields organized by sections (from AdvancedSearchFields.js)
export const GENOME_METADATA_FIELDS_DATA: GenomeMetadataFieldItem[] = [
  { field: "----- Frequent Fields -----", isLabel: true },
  { field: "genome_name" },
  { field: "genome_length" },
  { field: "feature_group" },
  { field: "species" },
  { field: "strain" },
  { field: "accession" },
  { field: "subtype" },
  { field: "lineage" },
  { field: "host_group" },
  { field: "host_common_name" },
  { field: "collection_date" },
  { field: "collection_year" },
  { field: "geographic_group" },
  { field: "isolation_country" },
  { field: "geographic_location" },
  { field: "----- General Info -----", isLabel: true },
  { field: "public" },
  { field: "genome_id" },
  { field: "genome_name" },
  { field: "other_name" },
  { field: "----- Taxonomy -----", isLabel: true },
  { field: "taxon_id" },
  { field: "taxon_lineage_ids" },
  { field: "taxon_lineage_names" },
  { field: "superkingdom" },
  { field: "kingdom" },
  { field: "phylum" },
  { field: "class" },
  { field: "order" },
  { field: "family" },
  { field: "genus" },
  { field: "species" },
  { field: "----- Status -----", isLabel: true },
  { field: "genome_status" },
  { field: "----- Type Info -----", isLabel: true },
  { field: "strain" },
  { field: "serovar" },
  { field: "biovar" },
  { field: "pathovar" },
  { field: "mlst" },
  { field: "segment" },
  { field: "subtype" },
  { field: "h_type" },
  { field: "n_type" },
  { field: "h1_clade_global" },
  { field: "h1_clade_us" },
  { field: "h3_clade" },
  { field: "h5_clade" },
  { field: "ph1n1_like" },
  { field: "clade" },
  { field: "subclade" },
  { field: "other_typing" },
  { field: "culture_collection" },
  { field: "type_strain" },
  { field: "reference_genome" },
  { field: "----- DB Cross Ref -----", isLabel: true },
  { field: "completion_date" },
  { field: "publication" },
  { field: "authors" },
  { field: "bioproject_accession" },
  { field: "biosample_accession" },
  { field: "assembly_accession" },
  { field: "sra_accession" },
  { field: "genbank_accessions" },
  { field: "----- Sequence Info -----", isLabel: true },
  { field: "sequencing_centers" },
  { field: "sequencing_platform" },
  { field: "sequencing_depth" },
  { field: "assembly_method" },
  { field: "----- Genome Statistics -----", isLabel: true },
  { field: "chromosomes" },
  { field: "plasmids" },
  { field: "contigs" },
  { field: "gc_content" },
  { field: "contig_l50" },
  { field: "contig_n50" },
  { field: "----- Genome Quality -----", isLabel: true },
  { field: "coarse_consistency" },
  { field: "fine_consistency" },
  { field: "checkm_completeness" },
  { field: "checkm_contamination" },
  { field: "genome_quality_flags" },
  { field: "genome_quality" },
  { field: "nearest_genomes" },
  { field: "outgroup_genomes" },
  { field: "----- Isolate Info -----", isLabel: true },
  { field: "isolation_source" },
  { field: "isolation_comments" },
  { field: "season" },
  { field: "state_province" },
  { field: "----- Host Info -----", isLabel: true },
  { field: "host_name" },
  { field: "host_gender", displayName: "Host Sex" },
  { field: "host_age" },
  { field: "host_health" },
  { field: "lab_host" },
  { field: "passage" },
  { field: "other_clinical" },
  { field: "----- Additional Info -----", isLabel: true },
  { field: "additional_metadata" },
  { field: "comments" },
  { field: "date_inserted" },
  { field: "date_modified" },
];

// Legacy: Flat array of all field names (excluding labels) for backward compatibility
export const GENOME_ADVANCED_FIELDS: string[] = GENOME_METADATA_FIELDS_DATA
  .filter((item) => !item.field.startsWith("-----"))
  .map((item) => item.field);

// Helper function to extract section label from field name
function extractSectionLabel(field: string): string {
  return field.replace(/^----- /, "").replace(/ -----$/, "");
}

// Helper function to check if a field is a label
export function isMetadataLabel(field: string): boolean {
  return field.startsWith("-----") && field.endsWith("-----");
}

// Transform metadata fields data into Select-compatible format
export interface MetadataSelectOption {
  value: string;
  label: string;
  isLabel: boolean;
  sectionLabel?: string;
}

export function getMetadataSelectOptions(
  formatLabel: (field: string) => string,
): MetadataSelectOption[] {
  return GENOME_METADATA_FIELDS_DATA.map((item) => {
    const isLabel = isMetadataLabel(item.field);
    return {
      value: item.field,
      label: isLabel
        ? extractSectionLabel(item.field)
        : item.displayName || formatLabel(item.field),
      isLabel,
      sectionLabel: isLabel ? extractSectionLabel(item.field) : undefined,
    };
  });
}

// Default form values
export const DEFAULT_VIRAL_GENOME_TREE_FORM_VALUES: ViralGenomeTreeFormData = {
  recipe: "RAxML",
  substitution_model: "GTR",
  trim_threshold: "0",
  gap_threshold: "0",
  sequences: [],
  metadata_fields: DEFAULT_METADATA_FIELDS.filter((f) => f.selected).map((f) => f.id),
  output_path: "",
  output_file: "",
};

