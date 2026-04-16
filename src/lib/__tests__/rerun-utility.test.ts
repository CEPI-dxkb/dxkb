import {
  rerunBooleanValue,
  normalizeToArray,
  buildPairedLibraries,
  buildSingleLibraries,
  buildSraLibraries,
  rerunJob,
} from "@/lib/rerun-utility";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/forms/tanstack-library-selection", () => ({
  getPairedLibraryId: (read1: string, read2: string) => `${read1}${read2}`,
  getPairedLibraryName: (read1: string, read2: string) =>
    `P(${read1.split("/").pop()}, ${read2.split("/").pop()})`,
  getSingleLibraryName: (read: string) => `S(${read.split("/").pop()})`,
}));

describe("rerunBooleanValue", () => {
  it("returns true for boolean true", () => {
    expect(rerunBooleanValue(true)).toBe(true);
  });

  it("returns true for number 1", () => {
    expect(rerunBooleanValue(1)).toBe(true);
  });

  it('returns true for string "true"', () => {
    expect(rerunBooleanValue("true")).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(rerunBooleanValue(false)).toBe(false);
  });

  it("returns false for number 0", () => {
    expect(rerunBooleanValue(0)).toBe(false);
  });

  it('returns false for string "false"', () => {
    expect(rerunBooleanValue("false")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(rerunBooleanValue(null)).toBe(false);
    expect(rerunBooleanValue(undefined)).toBe(false);
  });
});

describe("normalizeToArray", () => {
  it("wraps a single value in an array", () => {
    expect(normalizeToArray("hello")).toEqual(["hello"]);
    expect(normalizeToArray(42)).toEqual([42]);
  });

  it("passes an existing array through", () => {
    expect(normalizeToArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns empty array for null", () => {
    expect(normalizeToArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeToArray(undefined)).toEqual([]);
  });
});

describe("buildPairedLibraries", () => {
  it("constructs paired Library objects with id, name, type, and files", () => {
    const rerunData = {
      paired_end_libs: [
        { read1: "/ws/user/file_R1.fq", read2: "/ws/user/file_R2.fq" },
      ],
    };
    const result = buildPairedLibraries(rerunData);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "/ws/user/file_R1.fq/ws/user/file_R2.fq",
      name: "P(file_R1.fq, file_R2.fq)",
      type: "paired",
      files: ["/ws/user/file_R1.fq", "/ws/user/file_R2.fq"],
    });
  });

  it("filters out entries missing read1 or read2", () => {
    const rerunData = {
      paired_end_libs: [
        { read1: "/ws/file1.fq", read2: "" },
        { read1: "", read2: "/ws/file2.fq" },
        { read2: "/ws/file3.fq" },
      ],
    };
    const result = buildPairedLibraries(rerunData);
    expect(result).toHaveLength(0);
  });

  it("handles single object (not array) via normalizeToArray", () => {
    const rerunData = {
      paired_end_libs: { read1: "/a/r1.fq", read2: "/a/r2.fq" },
    };
    const result = buildPairedLibraries(rerunData);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("paired");
  });

  it("merges extra fields from getExtra callback", () => {
    const rerunData = {
      paired_end_libs: [
        { read1: "/a/r1.fq", read2: "/a/r2.fq", platform: "illumina" },
      ],
    };
    const result = buildPairedLibraries(rerunData, (lib) => ({
      platform: lib.platform,
    }));
    expect(result[0].platform).toBe("illumina");
  });
});

describe("buildSingleLibraries", () => {
  it("constructs single Library objects", () => {
    const rerunData = {
      single_end_libs: [{ read: "/ws/user/reads.fq" }],
    };
    const result = buildSingleLibraries(rerunData);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "/ws/user/reads.fq",
      name: "S(reads.fq)",
      type: "single",
      files: ["/ws/user/reads.fq"],
    });
  });

  it("filters entries missing read", () => {
    const rerunData = {
      single_end_libs: [{ read: "" }, { read: "/ws/valid.fq" }],
    };
    const result = buildSingleLibraries(rerunData);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("/ws/valid.fq");
  });

  it("supports getExtra callback", () => {
    const rerunData = {
      single_end_libs: [{ read: "/ws/reads.fq", platform: "nanopore" }],
    };
    const result = buildSingleLibraries(rerunData, (lib) => ({
      platform: lib.platform,
    }));
    expect(result[0].platform).toBe("nanopore");
  });
});

describe("buildSraLibraries", () => {
  it("uses srr_libs array with srr_accession field", () => {
    const rerunData = {
      srr_libs: [
        { srr_accession: "SRR12345" },
        { srr_accession: "SRR67890" },
      ],
    };
    const result = buildSraLibraries(rerunData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "SRR12345",
      name: "SRR12345",
      type: "sra",
    });
    expect(result[1]).toEqual({
      id: "SRR67890",
      name: "SRR67890",
      type: "sra",
    });
  });

  it("falls back to srr_ids when srr_libs is absent", () => {
    const rerunData = {
      srr_ids: ["SRR111", "SRR222"],
    };
    const result = buildSraLibraries(rerunData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "SRR111", name: "SRR111", type: "sra" });
  });

  it("returns empty array when neither srr_libs nor srr_ids present", () => {
    const result = buildSraLibraries({});
    expect(result).toEqual([]);
  });

  it("filters out srr_libs entries missing srr_accession", () => {
    const rerunData = {
      srr_libs: [{ srr_accession: "SRR111" }, { other: "field" }],
    };
    const result = buildSraLibraries(rerunData);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("SRR111");
  });

  it("merges extra fields from getExtra callback on srr_libs path", () => {
    const rerunData = {
      srr_libs: [
        { srr_accession: "SRR111", sample_id: "S1" },
        { srr_accession: "SRR222", sample_id: "S2" },
      ],
    };
    const result = buildSraLibraries(rerunData, (lib) => ({ sampleId: lib.sample_id }));
    expect(result).toEqual([
      { id: "SRR111", name: "SRR111", type: "sra", sampleId: "S1" },
      { id: "SRR222", name: "SRR222", type: "sra", sampleId: "S2" },
    ]);
  });

  it("invokes getExtra with empty record on srr_ids fallback path", () => {
    const rerunData = { srr_ids: ["SRR999"] };
    const seenLibs: Record<string, string>[] = [];
    const result = buildSraLibraries(rerunData, (lib) => {
      seenLibs.push(lib);
      return { sampleId: "default" };
    });
    expect(seenLibs).toEqual([{}]);
    expect(result).toEqual([
      { id: "SRR999", name: "SRR999", type: "sra", sampleId: "default" },
    ]);
  });
});

describe("rerunJob", () => {
  let mockSetItem: ReturnType<typeof vi.fn>;
  let mockOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetItem = vi.fn();
    mockOpen = vi.fn();
    vi.stubGlobal("sessionStorage", { setItem: mockSetItem, getItem: vi.fn() });
    vi.stubGlobal("window", { open: mockOpen });
    // Mock crypto.randomUUID for deterministic key generation
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-abcd-efgh-ijkl-mnopqrstuvwx" });
  });

  it("stores params in sessionStorage and opens correct route", () => {
    const params = { genome_id: "123" };
    rerunJob(params, "GenomeAssembly2");

    expect(mockSetItem).toHaveBeenCalledWith(
      "12345678",
      JSON.stringify(params),
    );
    expect(mockOpen).toHaveBeenCalledWith(
      "/services/genome-assembly?rerun_key=12345678",
      "_blank",
    );
  });

  it("shows toast error for unsupported service", async () => {
    const { toast } = await import("sonner");
    rerunJob({}, "UnsupportedService");

    expect(toast.error).toHaveBeenCalledWith(
      "The UnsupportedService service is not currently supported in DXKB",
    );
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("routes GeneTree with viral_genome tree_type to viral-genome-tree", () => {
    rerunJob({ tree_type: "viral_genome" }, "GeneTree");

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining("/services/viral-genome-tree"),
      "_blank",
    );
  });

  it("routes GeneTree with other tree_type to gene-protein-tree", () => {
    rerunJob({ tree_type: "gene" }, "GeneTree");

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining("/services/gene-protein-tree"),
      "_blank",
    );
  });

  it("maps various service IDs to correct routes", () => {
    const testCases = [
      ["GenomeAnnotation", "/services/genome-annotation"],
      ["Homology", "/services/blast"],
      ["MetagenomeBinning", "/services/metagenomic-binning"],
      ["MSA", "/services/msa-snp-analysis"],
      ["FastqUtils", "/services/fastq-utilities"],
      ["ViralAssembly", "/services/viral-assembly"],
    ];

    for (const [serviceId, expectedRoute] of testCases) {
      vi.clearAllMocks();
      rerunJob({}, serviceId);
      expect(mockOpen).toHaveBeenCalledWith(
        expect.stringContaining(expectedRoute),
        "_blank",
      );
    }
  });
});
