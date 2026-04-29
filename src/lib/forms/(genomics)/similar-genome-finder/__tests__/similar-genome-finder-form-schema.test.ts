import {
  similarGenomeFinderFormSchema,
  defaultSimilarGenomeFinderFormValues,
} from "../similar-genome-finder-form-schema";

const validPayload = {
  ...defaultSimilarGenomeFinderFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "sgf-1",
  fasta_file: "/ws/query.fasta",
};

describe("similarGenomeFinderFormSchema", () => {
  it("safeParse fails on the empty default payload (missing fasta_file, paths)", () => {
    const result = similarGenomeFinderFormSchema.safeParse(
      defaultSimilarGenomeFinderFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse accepts a filled-out happy-path payload", () => {
    const result = similarGenomeFinderFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse rejects an invalid scope enum", () => {
    const result = similarGenomeFinderFormSchema.safeParse({
      ...validPayload,
      scope: "not-a-scope",
    });
    expect(result.success).toBe(false);
  });
});
