vi.mock("../primer-design-form-schema", () => ({
  defaultPrimerDesignFormValues: {
    input_type: "sequence_text",
    sequence_input: "",
    output_path: "",
    output_file: "",
    SEQUENCE_ID: "",
    PRIMER_PICK_INTERNAL_OLIGO: false,
    PRIMER_PRODUCT_SIZE_RANGE: [],
    SEQUENCE_TARGET: [],
    SEQUENCE_INCLUDED_REGION: [],
    SEQUENCE_EXCLUDED_REGION: [],
    SEQUENCE_OVERLAP_JUNCTION_LIST: [],
    PRIMER_NUM_RETURN: 5,
    PRIMER_MIN_SIZE: 18,
    PRIMER_OPT_SIZE: "20",
    PRIMER_MAX_SIZE: 27,
  },
}));

import {
  sanitizePrimerDesignSequence,
  extractFastaHeader,
  stripPrimerMarkers,
  getSequenceForSubmission,
  validatePrimerDesignSequence,
  transformPrimerDesignParams,
  resetPrimerDesignValues,
  primerDesignRerunInputType,
} from "../primer-design-form-utils";

describe("sanitizePrimerDesignSequence", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizePrimerDesignSequence("")).toBe("");
  });

  it("removes spaces from sequence lines", () => {
    const result = sanitizePrimerDesignSequence("ATG C TGA");
    expect(result).toBe("ATGCTGA");
  });

  it("preserves header line and removes spaces from sequence lines", () => {
    const result = sanitizePrimerDesignSequence(">my header\nATG C TGA\nGCC A");
    expect(result).toBe(">my header\nATGCTGA\nGCCA");
  });

  it("normalizes \\r\\n newlines", () => {
    const result = sanitizePrimerDesignSequence(">hdr\r\nATGC\r\nGGCC");
    expect(result).toBe(">hdr\nATGC\nGGCC");
  });
});

describe("extractFastaHeader", () => {
  it("returns null for empty input", () => {
    expect(extractFastaHeader("")).toBeNull();
  });

  it("returns null when no > header is present", () => {
    expect(extractFastaHeader("ATGCATGC")).toBeNull();
  });

  it("extracts header text after >", () => {
    expect(extractFastaHeader(">sequence_1 description\nATGCATGC")).toBe(
      "sequence_1 description",
    );
  });

  it("returns null when header line is just >", () => {
    expect(extractFastaHeader(">\nATGC")).toBeNull();
  });
});

describe("stripPrimerMarkers", () => {
  it("removes markers from sequence lines", () => {
    const result = stripPrimerMarkers("ATG<C>TGA[GCC]{AAA}'T'");
    expect(result).toBe("ATGCTGAGCCAAAT");
  });

  it("preserves header line", () => {
    const result = stripPrimerMarkers(">my header\nATG<C>TGA");
    expect(result).toBe(">my header\nATGCTGA");
  });

  it("returns empty string for empty input", () => {
    expect(stripPrimerMarkers("")).toBe("");
  });
});

describe("getSequenceForSubmission", () => {
  it("returns empty string for empty input", () => {
    expect(getSequenceForSubmission("")).toBe("");
  });

  it("returns concatenated sequence without newlines", () => {
    const result = getSequenceForSubmission("ATGC\nGGCC");
    expect(result).toBe("ATGCGGCC");
  });

  it("strips header and returns concatenated sequence", () => {
    const result = getSequenceForSubmission(">header\nATGC\nGGCC");
    expect(result).toBe("ATGCGGCC");
  });
});

describe("validatePrimerDesignSequence", () => {
  it("returns invalid with 'empty' errorCode for empty input", () => {
    const result = validatePrimerDesignSequence("");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("empty");
  });

  it("returns invalid with 'empty' errorCode for whitespace-only input", () => {
    const result = validatePrimerDesignSequence("   ");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("empty");
  });

  it("returns isValid true for valid DNA sequence", () => {
    const result = validatePrimerDesignSequence("ATGCATGCNN");
    expect(result.isValid).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it("returns 'invalid_characters' errorCode for non-nucleotide characters", () => {
    const result = validatePrimerDesignSequence("ATGCXYZ");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("invalid_characters");
  });

  it("returns 'multiple_records' errorCode for multiple FASTA records", () => {
    const result = validatePrimerDesignSequence(
      ">record1 description\nATGC\n>record2 description\nGGCC",
    );
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("multiple_records");
  });

  it("returns valid for single FASTA record", () => {
    const result = validatePrimerDesignSequence(">record1\nATGCATGC");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedSequence).toContain("ATGCATGC");
  });
});

describe("transformPrimerDesignParams", () => {
  const baseFormData = {
    input_type: "sequence_text" as const,
    sequence_input: ">hdr\nATGCATGC",
    output_path: "/my/output",
    output_file: "primer_result",
    SEQUENCE_ID: "seq_001",
    PRIMER_PICK_INTERNAL_OLIGO: true,
    PRIMER_PRODUCT_SIZE_RANGE: ["50-500"],
    SEQUENCE_TARGET: ["100,200"],
    SEQUENCE_INCLUDED_REGION: [],
    SEQUENCE_EXCLUDED_REGION: ["10,20"],
    SEQUENCE_OVERLAP_JUNCTION_LIST: [],
    PRIMER_NUM_RETURN: "5",
    PRIMER_MIN_SIZE: "18",
    PRIMER_OPT_SIZE: "20",
    PRIMER_MAX_SIZE: "27",
  };

  it("maps basic fields", () => {
    const result = transformPrimerDesignParams(baseFormData);

    expect(result).toEqual(
      expect.objectContaining({
        output_path: "/my/output",
        output_file: "primer_result",
        input_type: "sequence_text",
      }),
    );
  });

  it("handles sequence_text input_type by sanitizing and stripping header", () => {
    const result = transformPrimerDesignParams(baseFormData);

    expect(result.sequence_input).toBe("ATGCATGC");
    expect(result.SEQUENCE_ID).toBe("seq_001");
  });

  it("sends a workspace FASTA as workspace_fasta with the trimmed path", () => {
    const data = {
      ...baseFormData,
      input_type: "workspace_fasta" as const,
      sequence_input: " /ws/file.fasta ",
    };
    const result = transformPrimerDesignParams(data);

    expect(result.input_type).toBe("workspace_fasta");
    expect(result.sequence_input).toBe("/ws/file.fasta");
    expect(result).not.toHaveProperty("SEQUENCE_ID");
  });

  it("includes region arrays as space-joined strings when non-empty", () => {
    const result = transformPrimerDesignParams(baseFormData);

    expect(result.SEQUENCE_TARGET).toBe("100,200");
    expect(result.SEQUENCE_EXCLUDED_REGION).toBe("10,20");
    expect(result).not.toHaveProperty("SEQUENCE_INCLUDED_REGION");
    expect(result).not.toHaveProperty("SEQUENCE_OVERLAP_JUNCTION_LIST");
  });

  it("includes PRIMER_PRODUCT_SIZE_RANGE with commas replaced by dashes", () => {
    const data = {
      ...baseFormData,
      PRIMER_PRODUCT_SIZE_RANGE: ["50,500", "100,300"],
    };
    const result = transformPrimerDesignParams(data);

    expect(result.PRIMER_PRODUCT_SIZE_RANGE).toBe("50-500 100-300");
  });

  it("omits blank region and product range tokens", () => {
    const result = transformPrimerDesignParams({
      ...baseFormData,
      SEQUENCE_TARGET: ["", "  "],
      PRIMER_PRODUCT_SIZE_RANGE: ["", "  "],
    });

    expect(result).not.toHaveProperty("SEQUENCE_TARGET");
    expect(result).not.toHaveProperty("PRIMER_PRODUCT_SIZE_RANGE");
  });

  it("includes scalar params when defined", () => {
    const result = transformPrimerDesignParams(baseFormData);

    expect(result.PRIMER_NUM_RETURN).toBe("5");
    expect(result.PRIMER_MIN_SIZE).toBe("18");
    expect(result.PRIMER_OPT_SIZE).toBe("20");
    expect(result.PRIMER_MAX_SIZE).toBe("27");
  });

  it("includes PRIMER_PICK_INTERNAL_OLIGO when defined", () => {
    const result = transformPrimerDesignParams(baseFormData);

    expect(result.PRIMER_PICK_INTERNAL_OLIGO).toBe(true);
  });

  it("omits SEQUENCE_ID when empty for sequence_text input", () => {
    const data = { ...baseFormData, SEQUENCE_ID: "" };
    const result = transformPrimerDesignParams(data);

    expect(result).not.toHaveProperty("SEQUENCE_ID");
  });

  it("handles empty sequence_input for sequence_text", () => {
    const data = { ...baseFormData, sequence_input: "" };
    const result = transformPrimerDesignParams(data);

    expect(result.sequence_input).toBe("");
  });

  it("includes multiple SEQUENCE_TARGET entries as space-joined string", () => {
    const data = { ...baseFormData, SEQUENCE_TARGET: ["100,200", "300,400"] };
    const result = transformPrimerDesignParams(data);

    expect(result.SEQUENCE_TARGET).toBe("100,200 300,400");
  });

  it("formats PRIMER_PRODUCT_SIZE_RANGE replacing commas with dashes", () => {
    const data = { ...baseFormData, PRIMER_PRODUCT_SIZE_RANGE: ["100,500"] };
    const result = transformPrimerDesignParams(data);

    expect(result.PRIMER_PRODUCT_SIZE_RANGE).toBe("100-500");
  });
});

describe("resetPrimerDesignValues", () => {
  it("returns a fresh copy of default values", () => {
    const first = resetPrimerDesignValues();
    const second = resetPrimerDesignValues();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("contains expected default fields", () => {
    const result = resetPrimerDesignValues();

    expect(result).toEqual(
      expect.objectContaining({
        input_type: "sequence_text",
        sequence_input: "",
        output_path: "",
        output_file: "",
      }),
    );
  });
});

describe("primerDesignRerunInputType", () => {
  it("opens both spellings of a workspace FASTA job as workspace_fasta", () => {
    expect(primerDesignRerunInputType("workspace_fasta")).toBe(
      "workspace_fasta",
    );
    expect(primerDesignRerunInputType("workplace_fasta")).toBe(
      "workspace_fasta",
    );
  });

  it("keeps sequence_text and ignores anything else", () => {
    expect(primerDesignRerunInputType("sequence_text")).toBe("sequence_text");
    expect(primerDesignRerunInputType("database_id")).toBeUndefined();
    expect(primerDesignRerunInputType(undefined)).toBeUndefined();
  });
});
