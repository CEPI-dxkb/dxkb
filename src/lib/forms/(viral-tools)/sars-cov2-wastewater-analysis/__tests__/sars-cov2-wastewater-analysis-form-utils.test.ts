vi.mock("./sars-cov2-wastewater-analysis-form-schema", () => ({}));
vi.mock("@/lib/forms/tanstack-library-selection", () => ({
  getPairedLibraryName: vi.fn((r1: string, r2: string) => r1 + " & " + r2),
  getSingleLibraryName: vi.fn((r: string) => r),
}));
vi.mock("@/types/services", () => ({}));

import {
  sanitizeSampleId,
  getDefaultSampleIdFromPath,
  getDefaultSampleIdFromSrr,
  handleLibraryError,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
  resolveSampleIdAndDate,
  transformSarsCov2WastewaterParams,
} from "../sars-cov2-wastewater-analysis-form-utils";

describe("sanitizeSampleId", () => {
  it("replaces dashes with underscores", () => {
    expect(sanitizeSampleId("sample-id")).toBe("sample_id");
  });

  it("replaces colons with underscores", () => {
    expect(sanitizeSampleId("sample:id")).toBe("sample_id");
  });

  it("replaces at-signs with underscores", () => {
    expect(sanitizeSampleId("user@host")).toBe("user_host");
  });

  it("replaces double quotes with underscores", () => {
    expect(sanitizeSampleId('sample"id')).toBe("sample_id");
  });

  it("replaces single quotes with underscores", () => {
    expect(sanitizeSampleId("sample'id")).toBe("sample_id");
  });

  it("replaces semicolons with underscores", () => {
    expect(sanitizeSampleId("sample;id")).toBe("sample_id");
  });

  it("replaces brackets with underscores", () => {
    expect(sanitizeSampleId("sample[id]")).toBe("sample_id_");
  });

  it("replaces braces with underscores", () => {
    expect(sanitizeSampleId("sample{id}")).toBe("sample_id_");
  });

  it("replaces pipes with underscores", () => {
    expect(sanitizeSampleId("sample|id")).toBe("sample_id");
  });

  it("replaces backticks with underscores", () => {
    expect(sanitizeSampleId("sample`id")).toBe("sample_id");
  });

  it("replaces multiple invalid chars at once", () => {
    expect(sanitizeSampleId("a-b:c@d")).toBe("a_b_c_d");
  });

  it("returns value unchanged when no invalid chars are present", () => {
    expect(sanitizeSampleId("valid_sample_123")).toBe("valid_sample_123");
  });
});

describe("getDefaultSampleIdFromPath", () => {
  it("extracts filename base from a full path", () => {
    expect(getDefaultSampleIdFromPath("/workspace/user/reads.fastq")).toBe(
      "reads",
    );
  });

  it("strips extension from simple filename", () => {
    expect(getDefaultSampleIdFromPath("sample.fq")).toBe("sample");
  });

  it("sanitizes invalid chars in the extracted filename base", () => {
    expect(getDefaultSampleIdFromPath("/ws/my-sample.fq")).toBe("my_sample");
  });

  it("handles path with no extension", () => {
    expect(getDefaultSampleIdFromPath("/ws/samplefile")).toBe("samplefile");
  });
});

describe("getDefaultSampleIdFromSrr", () => {
  it("strips dot-suffix from accession", () => {
    expect(getDefaultSampleIdFromSrr("SRR1234567.1")).toBe("SRR1234567");
  });

  it("returns accession as-is when no dot-suffix", () => {
    expect(getDefaultSampleIdFromSrr("SRR1234567")).toBe("SRR1234567");
  });
});

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
    handleLibraryError("Something went wrong", toast);
    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });
});

describe("resolveSampleIdAndDate", () => {
  it("sanitizes and returns the provided sample id", () => {
    const result = resolveSampleIdAndDate("my-sample", "");
    expect(result.sampleId).toBe("my_sample");
  });

  it("falls back to path when sample id is empty", () => {
    const result = resolveSampleIdAndDate("", "", "/ws/reads.fq");
    expect(result.sampleId).toBe("reads");
  });

  it("returns empty sampleId when no id and no fallback path", () => {
    const result = resolveSampleIdAndDate("", "");
    expect(result.sampleId).toBe("");
  });

  it("includes sampleLevelDate when provided and non-empty", () => {
    const result = resolveSampleIdAndDate("sample", "2024-01-15");
    expect(result.sampleLevelDate).toBe("2024-01-15");
  });

  it("omits sampleLevelDate when date is empty string", () => {
    const result = resolveSampleIdAndDate("sample", "");
    expect(result.sampleLevelDate).toBeUndefined();
  });

  it("omits sampleLevelDate when date is whitespace-only", () => {
    const result = resolveSampleIdAndDate("sample", "   ");
    expect(result.sampleLevelDate).toBeUndefined();
  });
});

describe("transformSarsCov2WastewaterParams", () => {
  const baseData = {
    recipe: "ARTIC" as const,
    primers: "ARTIC" as const,
    primer_version: "v4.1" as const,
    output_path: "/workspace/user/home",
    output_file: "wastewater-test",
    paired_end_libs: [],
    single_end_libs: [],
    srr_libs: [],
  };

  it("includes basic fields in the output", () => {
    const result = transformSarsCov2WastewaterParams(baseData as never);

    expect(result).toEqual(
      expect.objectContaining({
        recipe: "ARTIC",
        primers: "ARTIC",
        primer_version: "v4.1",
        output_path: "/workspace/user/home",
        output_file: "wastewater-test",
      }),
    );
  });

  it("does not include empty arrays for libraries", () => {
    const result = transformSarsCov2WastewaterParams(baseData as never);

    expect(result).not.toHaveProperty("paired_end_libs");
    expect(result).not.toHaveProperty("single_end_libs");
    expect(result).not.toHaveProperty("srr_libs");
  });

  it("maps paired_end_libs with sample_id and primers", () => {
    const data = {
      ...baseData,
      paired_end_libs: [
        {
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          sample_id: "sample1",
          sample_level_date: "2024-01-15",
        },
      ],
    };

    const result = transformSarsCov2WastewaterParams(data as never);

    expect(result.paired_end_libs).toEqual([
      {
        read1: "/ws/r1.fq",
        read2: "/ws/r2.fq",
        sample_id: "sample1",
        primers: "ARTIC",
        primer_version: "v4.1",
        sample_level_date: "2024-01-15",
      },
    ]);
  });

  it("maps single_end_libs with sample_id and primers", () => {
    const data = {
      ...baseData,
      single_end_libs: [
        {
          read: "/ws/reads.fq",
          sample_id: "single1",
          sample_level_date: "",
        },
      ],
    };

    const result = transformSarsCov2WastewaterParams(data as never);

    expect(result.single_end_libs).toEqual([
      {
        read: "/ws/reads.fq",
        sample_id: "single1",
        primers: "ARTIC",
        primer_version: "v4.1",
      },
    ]);
  });

  it("maps srr_libs with sample_id, primers, and optional title", () => {
    const data = {
      ...baseData,
      srr_libs: [
        {
          srr_accession: "SRR123456",
          sample_id: "srr1",
          sample_level_date: "2024-06-01",
          title: "My SRA Run",
        },
      ],
    };

    const result = transformSarsCov2WastewaterParams(data as never);

    expect(result.srr_libs).toEqual([
      {
        srr_accession: "SRR123456",
        sample_id: "srr1",
        primers: "ARTIC",
        primer_version: "v4.1",
        sample_level_date: "2024-06-01",
        title: "My SRA Run",
      },
    ]);
  });

  it("omits sample_level_date from libs when empty", () => {
    const data = {
      ...baseData,
      paired_end_libs: [
        {
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          sample_id: "s1",
          sample_level_date: "",
        },
      ],
    };

    const result = transformSarsCov2WastewaterParams(data as never);
    const lib = (result.paired_end_libs as Record<string, unknown>[])[0];

    expect(lib).not.toHaveProperty("sample_level_date");
  });

  it("omits title from srr_libs when not present", () => {
    const data = {
      ...baseData,
      srr_libs: [
        {
          srr_accession: "SRR999",
          sample_id: "s1",
          sample_level_date: "",
        },
      ],
    };

    const result = transformSarsCov2WastewaterParams(data as never);
    const lib = (result.srr_libs as Record<string, unknown>[])[0];

    expect(lib).not.toHaveProperty("title");
    expect(lib).not.toHaveProperty("sample_level_date");
  });
});

describe("getPairedLibraryBuildFn", () => {
  it("builds a paired library with sampleId and sampleLevelDate", () => {
    const buildFn = getPairedLibraryBuildFn("mySample", "2024-01-15");
    const result = buildFn("/ws/r1.fq", "/ws/r2.fq", "p1");

    expect(result.library).toEqual(
      expect.objectContaining({
        id: "p1",
        type: "paired",
        files: ["/ws/r1.fq", "/ws/r2.fq"],
        sampleId: "mySample",
        sampleLevelDate: "2024-01-15",
      }),
    );
  });

  it("falls back to path-derived sampleId when sampleId is empty", () => {
    const buildFn = getPairedLibraryBuildFn("", undefined);
    const result = buildFn("/ws/reads_R1.fq", "/ws/reads_R2.fq", "p1");

    expect(result.library).toEqual(
      expect.objectContaining({
        sampleId: "reads_R1",
      }),
    );
    expect((result.library as unknown as Record<string, unknown>).sampleLevelDate).toBeUndefined();
  });
});

describe("getSingleLibraryBuildFn", () => {
  it("builds a single library with sampleId", () => {
    const buildFn = getSingleLibraryBuildFn("mySample", "2024-06-01");
    const result = buildFn("/ws/reads.fq");

    expect(result.library).toEqual(
      expect.objectContaining({
        id: "/ws/reads.fq",
        type: "single",
        sampleId: "mySample",
        sampleLevelDate: "2024-06-01",
      }),
    );
  });

  it("falls back to path-derived sampleId when empty", () => {
    const buildFn = getSingleLibraryBuildFn("");
    const result = buildFn("/ws/sample.fq");

    expect(result.library).toEqual(
      expect.objectContaining({
        sampleId: "sample",
      }),
    );
  });
});

describe("singleLibraryDuplicateMatcher", () => {
  it("returns true when id and type match", () => {
    const library = { id: "/ws/reads.fq", type: "single" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(true);
  });

  it("returns false when id matches but type differs", () => {
    const library = { id: "/ws/reads.fq", type: "paired" } as never;
    expect(singleLibraryDuplicateMatcher(library, "/ws/reads.fq")).toBe(false);
  });
});
