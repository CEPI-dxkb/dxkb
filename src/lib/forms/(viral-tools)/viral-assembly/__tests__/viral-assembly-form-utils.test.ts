vi.mock("@/lib/forms/tanstack-library-selection", () => ({
  getPairedLibraryName: vi.fn((r1: string, r2: string) => r1 + " & " + r2),
  getSingleLibraryName: vi.fn((r: string) => r),
}));
vi.mock("@/types/services", () => ({}));

import {
  handleLibraryError,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
  transformViralAssemblyParams,
  viralAssemblyRerunValues,
} from "../viral-assembly-form-utils";
import { defaultViralAssemblyFormValues } from "../viral-assembly-form-schema";

describe("handleLibraryError", () => {
  it("shows duplicate library toast for paired duplicate message", () => {
    const toast = { error: vi.fn() };
    handleLibraryError(
      "This paired library has already been added",
      toast,
    );
    expect(toast.error).toHaveBeenCalledWith("Duplicate library", {
      description: "This paired library has already been added",
    });
  });

  it("shows duplicate library toast for single duplicate message", () => {
    const toast = { error: vi.fn() };
    handleLibraryError(
      "This single library has already been added",
      toast,
    );
    expect(toast.error).toHaveBeenCalledWith("Duplicate library", {
      description: "This single library has already been added",
    });
  });

  it("shows generic error toast for other messages", () => {
    const toast = { error: vi.fn() };
    handleLibraryError("Unknown error occurred", toast);
    expect(toast.error).toHaveBeenCalledWith("Unknown error occurred");
  });
});

describe("singleLibraryDuplicateMatcher", () => {
  it("returns true when id and type match", () => {
    const library = { id: "/ws/reads.fq", type: "single" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(true);
  });

  it("returns false when id matches but type is not single", () => {
    const library = { id: "/ws/reads.fq", type: "paired" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(false);
  });

  it("returns false when type matches but id differs", () => {
    const library = { id: "/ws/other.fq", type: "single" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(false);
  });

  it("returns false when neither id nor type match", () => {
    const library = { id: "/ws/other.fq", type: "paired" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(false);
  });
});

describe("transformViralAssemblyParams", () => {
  const baseData = {
    ...defaultViralAssemblyFormValues,
    strategy: "irma" as const,
    module: "CoV" as const,
    input_type: "paired" as const,
    output_path: "/workspace/user/home",
    output_file: "viral-assembly-test",
  };

  it("includes basic fields in the output", () => {
    const result = transformViralAssemblyParams(baseData);

    expect(result).toEqual(
      expect.objectContaining({
        strategy: "irma",
        module: "CoV",
        output_path: "/workspace/user/home",
        output_file: "viral-assembly-test",
      }),
    );
  });

  it("includes paired_end_lib for paired input_type", () => {
    const data = {
      ...baseData,
      input_type: "paired" as const,
      paired_end_libs: [
        { read1: "/ws/r1.fq", read2: "/ws/r2.fq" },
      ],
    };

    const result = transformViralAssemblyParams(data as never);

    expect(result.paired_end_lib).toEqual({
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
    });
  });

  it("uses only the first paired library", () => {
    const data = {
      ...baseData,
      input_type: "paired" as const,
      paired_end_libs: [
        { read1: "/ws/r1.fq", read2: "/ws/r2.fq" },
        { read1: "/ws/r3.fq", read2: "/ws/r4.fq" },
      ],
    };

    const result = transformViralAssemblyParams(data as never);

    expect(result.paired_end_lib).toEqual({
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
    });
  });

  it("includes single_end_lib for single input_type", () => {
    const data = {
      ...baseData,
      input_type: "single" as const,
      single_end_libs: [{ read: "/ws/single.fq" }],
    };

    const result = transformViralAssemblyParams(data as never);

    expect(result.single_end_lib).toEqual({ read: "/ws/single.fq" });
  });

  it("sends the SRA run as sra_id, as legacy does", () => {
    const data = {
      ...baseData,
      input_type: "srr_accession" as const,
      srr_ids: ["SRR123456"],
    };

    const result = transformViralAssemblyParams(data);

    expect(result.sra_id).toBe("SRR123456");
    expect(result).not.toHaveProperty("srr_id");
  });

  it("does not include paired_end_lib when input_type is single", () => {
    const data = {
      ...baseData,
      input_type: "single" as const,
      paired_end_libs: [{ read1: "/ws/r1.fq", read2: "/ws/r2.fq" }],
      single_end_libs: [{ read: "/ws/single.fq" }],
    };

    const result = transformViralAssemblyParams(data as never);

    expect(result).not.toHaveProperty("paired_end_lib");
    expect(result.single_end_lib).toEqual({ read: "/ws/single.fq" });
  });

  it("does not include library keys when paired_end_libs is empty for paired input", () => {
    const result = transformViralAssemblyParams(baseData);

    expect(result).not.toHaveProperty("paired_end_lib");
    expect(result).not.toHaveProperty("single_end_lib");
    expect(result).not.toHaveProperty("sra_id");
  });

  it("trims output_path and output_file", () => {
    const data = {
      ...baseData,
      output_path: "  /workspace/user/home  ",
      output_file: "  viral-assembly-test  ",
    };

    const result = transformViralAssemblyParams(data);

    expect(result.output_path).toBe("/workspace/user/home");
    expect(result.output_file).toBe("viral-assembly-test");
  });
});

describe("getPairedLibraryBuildFn", () => {
  it("returns a function that builds a paired library", () => {
    const buildFn = getPairedLibraryBuildFn();
    const result = buildFn("/ws/r1.fq", "/ws/r2.fq", "r1r2");

    expect(result.library).toEqual(
      expect.objectContaining({
        id: "r1r2",
        type: "paired",
        files: ["/ws/r1.fq", "/ws/r2.fq"],
      }),
    );
  });
});

describe("getSingleLibraryBuildFn", () => {
  it("returns a function that builds a single library", () => {
    const buildFn = getSingleLibraryBuildFn();
    const result = buildFn("/ws/reads.fq");

    expect(result.library).toEqual(
      expect.objectContaining({
        id: "/ws/reads.fq",
        type: "single",
        files: ["/ws/reads.fq"],
      }),
    );
  });
});

describe("transformViralAssemblyParams strategies", () => {
  const base = {
    ...defaultViralAssemblyFormValues,
    output_path: "/ws/home",
    output_file: "run",
    single_end_libs: [
      { _id: "single-1", _type: "single" as const, read: "/ws/single.fq" },
    ],
    input_type: "single" as const,
  };

  it("sends the module for IRMA, and no reference keys", () => {
    const result = transformViralAssemblyParams({
      ...base,
      strategy: "irma",
      module: "FLU-minion",
      reference_genbank_accession: "NC_045512.2",
    });
    expect(result).toEqual({
      strategy: "irma",
      module: "FLU-minion",
      output_path: "/ws/home",
      output_file: "run",
      single_end_lib: { read: "/ws/single.fq" },
    });
  });

  it("sends legacy's EBOLA for the Lloviu and Marburg module", () => {
    const result = transformViralAssemblyParams({
      ...base,
      strategy: "irma",
      module: "EBOLA_NON",
    });
    expect(result.module).toBe("EBOLA");
  });

  it("sends a GenBank reference without the module, accessions joined by commas", () => {
    const result = transformViralAssemblyParams({
      ...base,
      strategy: "reference_guided",
      module: "CoV",
      reference_type: "genbank",
      reference_genbank_accession: " NC_045512.2; MN908947.3 ",
      reference_fasta_file: "/ws/home/ref.fasta",
    });
    expect(result).toEqual({
      strategy: "reference_guided",
      reference_type: "genbank",
      reference_genbank_accession: "NC_045512.2,MN908947.3",
      output_path: "/ws/home",
      output_file: "run",
      single_end_lib: { read: "/ws/single.fq" },
    });
  });

  it("sends a FASTA reference without the module or an accession", () => {
    const result = transformViralAssemblyParams({
      ...base,
      strategy: "reference_guided",
      reference_type: "fasta",
      reference_genbank_accession: "NC_045512.2",
      reference_fasta_file: "/ws/home/ref.fasta",
    });
    expect(result).toEqual({
      strategy: "reference_guided",
      reference_type: "fasta",
      reference_fasta_file: "/ws/home/ref.fasta",
      output_path: "/ws/home",
      output_file: "run",
      single_end_lib: { read: "/ws/single.fq" },
    });
  });
});

describe("viralAssemblyRerunValues", () => {
  it("reopens a reference-guided GenBank job", () => {
    expect(
      viralAssemblyRerunValues({
        strategy: "reference_guided",
        reference_type: "genbank",
        reference_genbank_accession: "NC_045512.2",
      }),
    ).toEqual({
      strategy: "reference_guided",
      reference_type: "genbank",
      reference_genbank_accession: "NC_045512.2",
    });
  });

  it("reopens a reference-guided FASTA job, including legacy's UI value", () => {
    expect(
      viralAssemblyRerunValues({
        strategy: "reference-guided",
        reference_type: "fasta",
        reference_fasta_file: "/ws/home/ref.fasta",
      }),
    ).toEqual({
      strategy: "reference_guided",
      reference_type: "fasta",
      reference_fasta_file: "/ws/home/ref.fasta",
    });
  });

  it("joins an accession list sent as an array", () => {
    expect(
      viralAssemblyRerunValues({
        strategy: "reference_guided",
        reference_type: "genbank",
        reference_genbank_accession: ["NC_045512.2", "MN908947.3"],
      }).reference_genbank_accession,
    ).toBe("NC_045512.2,MN908947.3");
  });

  it("opens a genome or auto reference on GenBank, with no accession", () => {
    expect(
      viralAssemblyRerunValues({
        strategy: "reference_guided",
        reference_type: "auto",
        reference_genome_id: "11060.9352",
      }),
    ).toEqual({ strategy: "reference_guided", reference_type: "genbank" });
  });

  it("reopens an IRMA job with its module, and auto as IRMA", () => {
    expect(viralAssemblyRerunValues({ strategy: "irma", module: "RSV" })).toEqual(
      { strategy: "irma", module: "RSV" },
    );
    expect(viralAssemblyRerunValues({ strategy: "auto" })).toEqual({
      strategy: "irma",
    });
  });

  it("takes the first file of a reference FASTA list", () => {
    expect(
      viralAssemblyRerunValues({
        strategy: "reference_guided",
        reference_type: "fasta",
        reference_fasta_file: ["/ws/home/a.fasta", "/ws/home/b.fasta"],
      }).reference_fasta_file,
    ).toBe("/ws/home/a.fasta");
  });

  it("keeps the defaults for an unknown strategy or module", () => {
    expect(
      viralAssemblyRerunValues({ strategy: "map", module: "FLU-ref" }),
    ).toEqual({});
  });
});
