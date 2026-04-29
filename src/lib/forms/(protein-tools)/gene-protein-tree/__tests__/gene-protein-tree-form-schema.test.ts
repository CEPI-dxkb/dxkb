import {
  geneProteinTreeFormSchema,
  defaultGeneProteinTreeFormValues,
} from "../gene-protein-tree-form-schema";

const validPayload = {
  ...defaultGeneProteinTreeFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "gpt-1",
  sequences: [
    { filename: "/ws/seqs.fasta", type: "feature_group" as const },
  ],
};

describe("geneProteinTreeFormSchema", () => {
  it("safeParse fails on the empty default payload (no sequences, empty paths)", () => {
    const result = geneProteinTreeFormSchema.safeParse(
      defaultGeneProteinTreeFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = geneProteinTreeFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid recipe enum", () => {
    const result = geneProteinTreeFormSchema.safeParse({
      ...validPayload,
      recipe: "not-a-recipe",
    });
    expect(result.success).toBe(false);
  });
});
