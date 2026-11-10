import { z } from "zod";

export const baseGenomeAnnotationSchema = z.object({
  contigs: z.string().min(1, "Contigs must be provided"),
  recipe: z.enum(["default", "viral", "viral-lowvan", "phage"], {
    error: "Annotation recipe must be selected",
  }),
  scientific_name: z.string().nullable(),
  taxonomy_id: z.string().nullable(),
  my_label: z.string().min(1, "My label is required"),
  output_file: z.string().min(1, "Output file name is required"),
  output_path: z.string().min(1, "Output path is required"),
});

export const completeGenomeAnnotationSchema =
  baseGenomeAnnotationSchema.superRefine((data, ctx) => {
    if (data.scientific_name === null) {
      ctx.addIssue({
        code: "custom",
        message: "Taxonomy Name is required",
        path: ["scientific_name"],
      });
    }
    if (data.taxonomy_id === null) {
      ctx.addIssue({
        code: "custom",
        message: "Taxonomy ID is required",
        path: ["taxonomy_id"],
      });
    }
  });

export type GenomeAnnotationFormData = z.infer<
  typeof completeGenomeAnnotationSchema
>;

export const defaultGenomeAnnotationFormValues: GenomeAnnotationFormData = {
  contigs: "",
  recipe: "default",
  scientific_name: null,
  taxonomy_id: null,
  my_label: "",
  output_file: "",
  output_path: "",
};
