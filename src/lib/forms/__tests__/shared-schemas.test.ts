import {
  libraryTypeSchema,
  platformSchema,
  baseLibrarySchema,
  getLibraryTypeLabel,
} from "@/lib/forms/shared-schemas";

describe("libraryTypeSchema", () => {
  it("accepts valid values", () => {
    expect(libraryTypeSchema.parse("paired")).toBe("paired");
    expect(libraryTypeSchema.parse("single")).toBe("single");
    expect(libraryTypeSchema.parse("srr_accession")).toBe("srr_accession");
  });

  it("rejects invalid values", () => {
    expect(() => libraryTypeSchema.parse("invalid")).toThrow();
    expect(() => libraryTypeSchema.parse("")).toThrow();
    expect(() => libraryTypeSchema.parse(123)).toThrow();
  });
});

describe("platformSchema", () => {
  it("accepts valid values", () => {
    expect(platformSchema.parse("illumina")).toBe("illumina");
    expect(platformSchema.parse("pacbio")).toBe("pacbio");
    expect(platformSchema.parse("nanopore")).toBe("nanopore");
  });

  it("rejects invalid values", () => {
    expect(() => platformSchema.parse("sanger")).toThrow();
    expect(() => platformSchema.parse("")).toThrow();
    expect(() => platformSchema.parse(null)).toThrow();
  });
});

describe("baseLibrarySchema", () => {
  it("parses valid input with all fields", () => {
    const input = {
      _id: "lib-1",
      _type: "paired",
      read1: "/path/r1.fq",
      read2: "/path/r2.fq",
    };
    const result = baseLibrarySchema.parse(input);
    expect(result._id).toBe("lib-1");
    expect(result._type).toBe("paired");
    expect(result.read1).toBe("/path/r1.fq");
    expect(result.read2).toBe("/path/r2.fq");
  });

  it("parses valid input with only required fields", () => {
    const input = { _id: "lib-2", _type: "single" };
    const result = baseLibrarySchema.parse(input);
    expect(result._id).toBe("lib-2");
    expect(result._type).toBe("single");
    expect(result.read).toBeUndefined();
    expect(result.read1).toBeUndefined();
    expect(result.read2).toBeUndefined();
  });

  it("parses single library with read field", () => {
    const input = { _id: "lib-3", _type: "single", read: "/path/reads.fq" };
    const result = baseLibrarySchema.parse(input);
    expect(result.read).toBe("/path/reads.fq");
  });

  it("rejects missing _id", () => {
    expect(() => baseLibrarySchema.parse({ _type: "paired" })).toThrow();
  });

  it("rejects missing _type", () => {
    expect(() => baseLibrarySchema.parse({ _id: "lib-1" })).toThrow();
  });

  it("rejects invalid _type value", () => {
    expect(() =>
      baseLibrarySchema.parse({ _id: "lib-1", _type: "invalid" }),
    ).toThrow();
  });
});

describe("getLibraryTypeLabel", () => {
  it("maps known types to labels", () => {
    expect(getLibraryTypeLabel("paired")).toBe("Paired Read");
    expect(getLibraryTypeLabel("single")).toBe("Single Read");
    expect(getLibraryTypeLabel("sra")).toBe("SRA Accession");
  });

  it("returns the input for unknown types", () => {
    expect(getLibraryTypeLabel("unknown")).toBe("unknown");
    expect(getLibraryTypeLabel("custom_type")).toBe("custom_type");
  });
});
