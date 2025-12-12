import { z } from "zod";

// Taxonomy item schema
export const taxonomyItemSchema = z.object({
  taxon_id: z.number(),
  taxon_name: z.string(),
  taxon_rank: z.string().optional(),
  lineage_names: z.array(z.string()).optional(),
  division: z.string().optional(),
});

// Base schema for genome annotation form
export const baseGenomeAnnotationSchema = z.object({
  contigs: z.string().min(1, "Contigs must be provided"),
  recipe: z.enum(["default", "viral", "viral-lowvan", "phage"], {
    required_error: "Annotation recipe must be selected",
  }),
  scientific_name: z.string().nullable(),
  taxonomy_id: z.string().nullable(),
  my_label: z.string().min(1, "My label is required"),
  output_file: z.string().min(1, "Output file name is required"),
  output_path: z.string().min(1, "Output path is required"),
});

// Complete form schema with refined validation for required taxonomy fields
export const completeGenomeAnnotationSchema = baseGenomeAnnotationSchema.superRefine(
  (data, ctx) => {
    if (data.scientific_name === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Taxonomy Name is required",
        path: ["scientific_name"],
      });
    }
    if (data.taxonomy_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Taxonomy ID is required",
        path: ["taxonomy_id"],
      });
    }
  }
);

// Default form values
export const DEFAULT_GENOME_ANNOTATION_FORM_VALUES = {
  contigs: "",
  recipe: "default" as const,
  scientific_name: null,
  taxonomy_id: null,
  my_label: "",
  output_file: "",
  output_path: "",
};

// Type inference for the complete form schema
export type GenomeAnnotationFormData = z.infer<typeof completeGenomeAnnotationSchema>;
