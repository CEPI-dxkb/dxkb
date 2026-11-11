import { z } from "zod";

export const metaCatsInputTypeSchema = z.enum(["auto", "groups", "files"]);

export const metaCatsAlphabetSchema = z.enum(["na", "aa"]);

export const metadataOptions = [
  { value: "accession", label: "Accession" },
  { value: "collection_date", label: "Collection Date" },
  { value: "collection_year", label: "Collection Year" },
  { value: "genome_group", label: "Genome Group" },
  { value: "genome_id", label: "Genome ID" },
  { value: "genome_length", label: "Genome Length" },
  { value: "genome_name", label: "Genome Name" },
  { value: "genus", label: "Genus" },
  { value: "geographic_group", label: "Geographic Group" },
  { value: "geographic_location", label: "Geographic Location" },
  { value: "h1_clade_global", label: "H1 Clade Global" },
  { value: "h1_clade_us", label: "H1 Clade US" },
  { value: "h3_clade", label: "H3 Clade" },
  { value: "h5_clade", label: "H5 Clade" },
  { value: "host_group", label: "Host Group" },
  { value: "host_common_name", label: "Host Common Name" },
  { value: "host_name", label: "Host Name" },
  { value: "isolation_country", label: "Isolation Country" },
  { value: "lineage", label: "Lineage" },
  { value: "species", label: "Species" },
  { value: "strain", label: "Strain" },
  { value: "subtype", label: "Subtype" },
] as const;

export type MetadataOption = (typeof metadataOptions)[number]["value"];

export const autoGroupItemSchema = z.object({
  id: z.string(),
  patric_id: z.string(),
  metadata: z.string(),
  group: z.string(),
  genome_id: z.string(),
  genbank_accessions: z.string().optional(),
  strain: z.string().optional(),
});

export type AutoGroupItem = z.infer<typeof autoGroupItemSchema>;

export const metaCatsFormSchema = z
  .object({
    p_value: z.number().min(0).max(1),

    input_type: metaCatsInputTypeSchema,

    metadata_group: z.string().optional(),
    year_ranges: z.string().optional(),
    auto_groups: z.array(autoGroupItemSchema).optional(),
    auto_alphabet: metaCatsAlphabetSchema.optional(),

    groups: z.array(z.string()).optional(),
    group_alphabet: metaCatsAlphabetSchema.optional(),

    alignment_file: z.string().optional(),
    alignment_type: z.string().optional(),
    group_file: z.string().optional(),

    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    if (data.p_value <= 0 || data.p_value > 1) {
      ctx.addIssue({
        code: "custom",
        message: "P-value must be between 0 and 1",
        path: ["p_value"],
      });
    }

    if (data.input_type === "auto") {
      if (!data.auto_groups || data.auto_groups.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one feature group must be added",
          path: ["auto_groups"],
        });
        return;
      }

      const uniqueGroups = new Set(data.auto_groups.map((item) => item.group));
      if (uniqueGroups.size < minGroups) {
        ctx.addIssue({
          code: "custom",
          message: `At least ${String(minGroups)} different groups are required`,
          path: ["auto_groups"],
        });
      }
      if (uniqueGroups.size > maxGroups) {
        ctx.addIssue({
          code: "custom",
          message: `Maximum ${String(maxGroups)} groups are allowed`,
          path: ["auto_groups"],
        });
      }
    }

    if (data.input_type === "groups") {
      if (!data.groups || data.groups.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one feature group must be selected",
          path: ["groups"],
        });
        return;
      }

      if (data.groups.length < minGroups) {
        ctx.addIssue({
          code: "custom",
          message: `At least ${String(minGroups)} feature groups are required`,
          path: ["groups"],
        });
      }
      if (data.groups.length > maxGroups) {
        ctx.addIssue({
          code: "custom",
          message: `Maximum ${String(maxGroups)} feature groups are allowed`,
          path: ["groups"],
        });
      }
    }

    if (data.input_type === "files") {
      if (!data.alignment_file || data.alignment_file.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Alignment file is required",
          path: ["alignment_file"],
        });
      }
      if (!data.group_file || data.group_file.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Group file is required",
          path: ["group_file"],
        });
      }
    }
  });

export type MetaCatsFormData = z.infer<typeof metaCatsFormSchema>;

export const maxGroups = 10;
export const minGroups = 2;

export const defaultMetaCatsFormValues: MetaCatsFormData = {
  p_value: 0.05,
  input_type: "auto",
  metadata_group: "host_name",
  year_ranges: "",
  auto_groups: [],
  auto_alphabet: "aa",
  groups: [],
  group_alphabet: "aa",
  alignment_file: "",
  alignment_type: "",
  group_file: "",
  output_path: "",
  output_file: "",
};
