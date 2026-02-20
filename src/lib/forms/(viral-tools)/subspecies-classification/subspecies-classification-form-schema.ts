import { z } from "zod";

// -----------------------------------------------------------------------------
// Input source
// -----------------------------------------------------------------------------

export const inputSourceSchema = z.enum(["fasta_data", "fasta_file"]);
export type InputSource = z.infer<typeof inputSourceSchema>;

// -----------------------------------------------------------------------------
// Virus type options (legacy API values from BV-BRC SubspeciesClassification.js)
// -----------------------------------------------------------------------------

export const subspeciesVirusTypeOptions: { value: string; label: string }[] = [
  { value: "MASTADENOA", label: "Adenoviridae - Human mastadenovirus A [complete genome, genomic RNA]" },
  { value: "MASTADENOB", label: "Adenoviridae - Human mastadenovirus B [complete genome, genomic RNA]" },
  { value: "MASTADENOC", label: "Adenoviridae - Human mastadenovirus C [complete genome, genomic RNA]" },
  { value: "MASTADENOE", label: "Adenoviridae - Human mastadenovirus E [complete genome, genomic RNA]" },
  { value: "MASTADENOF", label: "Adenoviridae - Human mastadenovirus F [complete genome, genomic RNA]" },
  { value: "NOROORF1", label: "Caliciviridae - Norovirus [VP2 gene, genomic RNA]" },
  { value: "NOROORF2", label: "Caliciviridae - Norovirus [VP1 gene, genomic RNA]" },
  { value: "BOVDIARRHEA1", label: "Flaviviridae - Bovine viral diarrhea virus [5'UTR region, genomic RNA]" },
  { value: "DENGUE", label: "Flaviviridae - Dengue virus [complete genome, genomic RNA]" },
  { value: "HCV", label: "Flaviviridae - Hepatitis C virus [polyprotein gene, genomic RNA]" },
  { value: "JAPENCEPH", label: "Flaviviridae - Japanese encephalitis virus [complete genome, genomic RNA]" },
  { value: "MURRAY", label: "Flaviviridae - Murray Valley encephalitis virus [envelope protein (E), genomic RNA]" },
  { value: "STLOUIS", label: "Flaviviridae - St. Louis encephalitis virus [polyprotein gene, genomic RNA]" },
  { value: "TKBENCEPH", label: "Flaviviridae - Tick-borne encephalitis virus [polyprotein gene, genomic RNA]" },
  { value: "WESTNILE", label: "Flaviviridae - West Nile virus [complete genome, genomic RNA]" },
  { value: "YELLOWFEVER", label: "Flaviviridae - Yellow fever virus [polyprotein mRNA, mRNA]" },
  { value: "ZIKA", label: "Flaviviridae - Zika virus [complete genome, genomic RNA]" },
  { value: "INFLUENZAH5", label: "Orthomyxoviridae - Influenza A H5 [Hemagglutinin gene, genomic RNA]" },
  { value: "SWINEH1", label: "Orthomyxoviridae - Swine influenza H1 (global classification) [Hemagglutinin gene, genomic RNA]" },
  { value: "SWINEH1US", label: "Orthomyxoviridae – Swine influenza H1 (US classification) [Hemagglutinin gene, genomic RNA]" },
  { value: "SWINEH3", label: "Orthomyxoviridae - Swine influenza H3 (global classification, beta version) [Hemagglutinin gene, genomic RNA]" },
  { value: "MEASLES", label: "Paramyxoviridae - Measles morbillivirus [complete genome, genomic RNA]" },
  { value: "MUMPS", label: "Paramyxoviridae - Mumps orthorubulavirus [complete genome, genomic RNA]" },
  { value: "MPOX", label: "Poxviridae - Monkeypox virus [complete genome, genomic DNA]" },
  { value: "ROTAA", label: "Reoviridae - Rotavirus A [complete genome, genomic RNA]" },
];

const firstVirusType = subspeciesVirusTypeOptions[0]?.value ?? "MASTADENOA";

// -----------------------------------------------------------------------------
// Main form schema
// -----------------------------------------------------------------------------

export const subspeciesClassificationFormSchema = z
  .object({
    input_source: inputSourceSchema,
    input_fasta_data: z.string().optional(),
    input_fasta_file: z.string().optional(),
    virus_type: z.string().min(1, "Species is required"),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    if (data.input_source === "fasta_data") {
      const trimmed = (data.input_fasta_data ?? "").trim();
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sequence is required when entering sequence",
          path: ["input_fasta_data"],
        });
      }
    }
    if (data.input_source === "fasta_file") {
      const file = (data.input_fasta_file ?? "").trim();
      if (!file) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FASTA file is required when selecting a file",
          path: ["input_fasta_file"],
        });
      }
    }
  });

export type SubspeciesClassificationFormData = z.infer<
  typeof subspeciesClassificationFormSchema
>;

export const defaultSubspeciesClassificationFormValues: SubspeciesClassificationFormData = {
  input_source: "fasta_data",
  input_fasta_data: "",
  input_fasta_file: "",
  virus_type: firstVirusType,
  output_path: "",
  output_file: "",
};
