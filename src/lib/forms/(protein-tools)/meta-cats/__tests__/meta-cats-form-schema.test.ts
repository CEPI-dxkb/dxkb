import {
  metaCatsFormSchema,
  defaultMetaCatsFormValues,
} from "../meta-cats-form-schema";

const validPayload = {
  ...defaultMetaCatsFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "mc-1",
  auto_groups: [
    {
      id: "row-1",
      patric_id: "fig|83332.111.peg.1",
      metadata: "host_name",
      group: "groupA",
      genome_id: "83332.111",
    },
    {
      id: "row-2",
      patric_id: "fig|83333.111.peg.1",
      metadata: "host_name",
      group: "groupB",
      genome_id: "83333.111",
    },
  ],
};

describe("metaCatsFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = metaCatsFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = metaCatsFormSchema.safeParse(defaultMetaCatsFormValues);
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = metaCatsFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = metaCatsFormSchema.safeParse({
      ...validPayload,
      input_type: "not-a-real-input",
    });
    expect(result.success).toBe(false);
  });
});
