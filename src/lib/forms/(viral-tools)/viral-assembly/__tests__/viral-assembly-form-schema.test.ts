import {
  viralAssemblyFormSchema,
  defaultViralAssemblyFormValues,
  genbankAccessions,
  moduleOptions,
  referenceTypeOptions,
  strategyOptions,
} from "../viral-assembly-form-schema";

const validPayload = {
  ...defaultViralAssemblyFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "viral-1",
  paired_end_libs: [
    {
      _id: "lib-1",
      _type: "paired" as const,
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
      platform: "illumina",
    },
  ],
};

describe("viralAssemblyFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = viralAssemblyFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = viralAssemblyFormSchema.safeParse(
      defaultViralAssemblyFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = viralAssemblyFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = viralAssemblyFormSchema.safeParse({
      ...validPayload,
      input_type: "not-an-input",
    });
    expect(result.success).toBe(false);
  });
});

describe("viralAssemblyFormSchema reference guided", () => {
  const referenceGuided = {
    ...validPayload,
    strategy: "reference_guided" as const,
  };

  function issuesAt(payload: unknown, path: string) {
    const result = viralAssemblyFormSchema.safeParse(payload);
    if (result.success) return [];
    return result.error.issues
      .filter((issue) => issue.path.join(".") === path)
      .map((issue) => issue.message);
  }

  it("requires a GenBank accession by default", () => {
    expect(issuesAt(referenceGuided, "reference_genbank_accession")).toEqual([
      "GenBank accession is required",
    ]);
  });

  it.each([
    "NC_045512.2",
    "nc_045512.2",
    "NC_045512.2,MN908947.3",
    "NC_045512.2; MN908947.3",
    "NZ_CP012345.1",
    "MN908947",
  ])("accepts the accession list %j", (accession) => {
    const result = viralAssemblyFormSchema.safeParse({
      ...referenceGuided,
      reference_genbank_accession: accession,
    });
    expect(result.success).toBe(true);
  });

  it.each(["NC 045512.2", "045512.2", "NC_045512.2,not-an-accession", " , "])(
    "rejects the accession list %j",
    (accession) => {
      expect(
        issuesAt(
          { ...referenceGuided, reference_genbank_accession: accession },
          "reference_genbank_accession",
        ),
      ).toHaveLength(1);
    },
  );

  it("requires a reference FASTA file when the reference is a FASTA file", () => {
    const fasta = { ...referenceGuided, reference_type: "fasta" as const };
    expect(issuesAt(fasta, "reference_fasta_file")).toEqual([
      "Reference FASTA file is required",
    ]);
    expect(issuesAt(fasta, "reference_genbank_accession")).toEqual([]);
    expect(
      viralAssemblyFormSchema.safeParse({
        ...fasta,
        reference_fasta_file: "/ws/home/ref.fasta",
      }).success,
    ).toBe(true);
  });

  it("ignores the reference fields for IRMA", () => {
    expect(
      viralAssemblyFormSchema.safeParse({
        ...validPayload,
        strategy: "irma",
        reference_genbank_accession: "not an accession",
      }).success,
    ).toBe(true);
  });
});

describe("viral assembly options", () => {
  it("offers legacy's strategies", () => {
    expect(strategyOptions).toEqual([
      { value: "irma", label: "IRMA" },
      { value: "reference_guided", label: "Reference Guided Assembly" },
    ]);
  });

  it("offers legacy's 18 IRMA modules in legacy's order, each described", () => {
    expect(moduleOptions.map((option) => option.value)).toEqual([
      "FLU",
      "FLU_AD",
      "FLU-alt",
      "FLU-avian",
      "FLU-avian-residual",
      "FLU-fast",
      "FLU-lowQC",
      "FLU-minion",
      "FLU-pacbio",
      "FLU-pgm",
      "FLU-roche",
      "FLU-secondary",
      "FLU-sensitive",
      "FLU-utr",
      "CoV",
      "RSV",
      "EBOLA_NON",
      "EBOLA",
    ]);
    expect(moduleOptions[0]).toEqual({
      value: "FLU",
      label: "Influenza A & B",
      description: "Standard influenza assembly workflow (default)",
    });
    expect(moduleOptions.every((option) => option.description)).toBe(true);
  });

  it("offers GenBank and FASTA references, GenBank first", () => {
    expect(referenceTypeOptions).toEqual([
      { value: "genbank", label: "GenBank Accession" },
      { value: "fasta", label: "Upload FASTA" },
    ]);
    expect(defaultViralAssemblyFormValues.reference_type).toBe("genbank");
  });
});

describe("genbankAccessions", () => {
  it("splits on commas or semicolons and trims", () => {
    expect(genbankAccessions(" NC_045512.2 ;MN908947.3,, OK091006.1 ")).toEqual(
      ["NC_045512.2", "MN908947.3", "OK091006.1"],
    );
  });
});
