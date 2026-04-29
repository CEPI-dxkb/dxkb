import {
  completeGenomeAnnotationSchema,
  defaultGenomeAnnotationFormValues,
} from "../genome-annotation-form-schema";

const validPayload = {
  ...defaultGenomeAnnotationFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "annotate-1",
  contigs: "/ws/genome.fasta",
  scientific_name: "Escherichia coli",
  taxonomy_id: "562",
  my_label: "ecoli-1",
};

describe("completeGenomeAnnotationSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = completeGenomeAnnotationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = completeGenomeAnnotationSchema.safeParse(
      defaultGenomeAnnotationFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty contigs", () => {
    const result = completeGenomeAnnotationSchema.safeParse({
      ...validPayload,
      contigs: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid recipe enum", () => {
    const result = completeGenomeAnnotationSchema.safeParse({
      ...validPayload,
      recipe: "not-a-recipe",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty my_label", () => {
    const result = completeGenomeAnnotationSchema.safeParse({
      ...validPayload,
      my_label: "",
    });
    expect(result.success).toBe(false);
  });
});
