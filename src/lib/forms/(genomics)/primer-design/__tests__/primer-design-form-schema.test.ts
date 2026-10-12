import {
  primerDesignFormSchema,
  defaultPrimerDesignFormValues,
} from "../primer-design-form-schema";

const validPayload = {
  ...defaultPrimerDesignFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "primer-1",
  sequence_input: ">seq\nACGTACGTACGTACGT\n",
};

describe("primerDesignFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = primerDesignFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = primerDesignFormSchema.safeParse(
      defaultPrimerDesignFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      input_type: "not-a-real-input",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a workspace FASTA and requires its path", () => {
    const workspace = {
      ...validPayload,
      input_type: "workspace_fasta",
      sequence_input: "/e2e-test-user@patricbrc.org/home/gene.fna",
    };
    expect(primerDesignFormSchema.safeParse(workspace).success).toBe(true);

    const result = primerDesignFormSchema.safeParse({
      ...workspace,
      sequence_input: " ",
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        message: "Select a FASTA file from the workspace",
        path: ["sequence_input"],
      }),
    ]);
  });

  it("rejects the app spec's misspelled workplace_fasta", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      input_type: "workplace_fasta",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects more than one included region pair", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      SEQUENCE_INCLUDED_REGION: ["20,400", "500,100"],
    });
    expect(result.success).toBe(false);
  });
});
