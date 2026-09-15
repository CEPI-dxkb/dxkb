import {
  rerunBooleanValue,
  normalizeToArray,
  buildPairedLibraries,
  buildSingleLibraries,
  buildSraLibraries,
  closeRerunWindow,
  rerunJob,
  rerunPopupBlockedMessage,
  rerunWindowClosedMessage,
  reserveRerunWindow,
} from "@/lib/rerun-utility";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/forms/tanstack-library-selection", () => ({
  getPairedLibraryId: (read1: string, read2: string) => `${read1}${read2}`,
  getPairedLibraryName: (read1: string, read2: string) =>
    `P(${read1.split("/").pop() ?? ""}, ${read2.split("/").pop() ?? ""})`,
  getSingleLibraryName: (read: string) => `S(${read.split("/").pop() ?? ""})`,
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
  let mockRemoveItem: ReturnType<typeof vi.fn>;
  let mockOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetItem = vi.fn();
    mockRemoveItem = vi.fn();
    mockOpen = vi.fn();
    vi.stubGlobal("sessionStorage", {
      setItem: mockSetItem,
      removeItem: mockRemoveItem,
      getItem: vi.fn(),
    });
    vi.stubGlobal("window", { open: mockOpen });
    // Mock crypto.randomUUID for deterministic key generation
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-abcd-efgh-ijkl-mnopqrstuvwx" });
  });

  it("opens with an opener for sessionStorage cloning, then severs it", () => {
    const params = { genome_id: "123" };
    const rerunWindow = { opener: window };
    mockOpen.mockReturnValue(rerunWindow);

    const result = rerunJob(params, "GenomeAssembly2");

    expect(mockSetItem).toHaveBeenCalledWith(
      "12345678",
      JSON.stringify(params),
    );
    expect(mockOpen).toHaveBeenCalledWith(
      "/services/genome-assembly?rerun_key=12345678",
      "_blank",
    );
    expect(rerunWindow.opener).toBeNull();
    expect(result).toEqual({ status: "opened" });
  });

  it("returns an unsupported service to the caller without reporting it itself", async () => {
    const { toast } = await import("sonner");
    const result = rerunJob({}, "UnsupportedService");

    expect(result).toEqual({
      status: "unsupportedService",
      message:
        "The UnsupportedService service is not currently supported in DXKB",
    });
    // It used to toast *and* return the message, so a caller that rendered
    // `launch.message` inline reported the same failure twice.
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("reports a blocked pop-up and strands no payload behind it", async () => {
    const { toast } = await import("sonner");
    mockOpen.mockReturnValue(null);

    const result = rerunJob({ genome_id: "123" }, "GenomeAssembly2");

    expect(result).toEqual({
      status: "blockedPopup",
      message: rerunPopupBlockedMessage,
    });
    // Nothing will ever read the key, so it must not linger in sessionStorage.
    expect(mockRemoveItem).toHaveBeenCalledWith("12345678");
    // The choosers show this inline next to their retry button instead.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("navigates a reserved tab and writes the payload into its own storage", () => {
    const setItem = vi.fn();
    const replace = vi.fn();
    const resultWindow = {
      closed: false,
      opener: window,
      sessionStorage: { setItem },
      location: { replace },
    } as unknown as Window;

    const params = { genome_id: "123" };
    const result = rerunJob(params, "GenomeAssembly2", { resultWindow });

    // The reserved tab cloned this tab's storage when it opened, so writing here
    // would never reach it.
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledWith("12345678", JSON.stringify(params));
    expect(replace).toHaveBeenCalledWith(
      "/services/genome-assembly?rerun_key=12345678",
    );
    expect(resultWindow.opener).toBeNull();
    expect(mockOpen).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "opened" });
  });

  it("reports a reserved tab the user closed before the launch resolved", () => {
    const setItem = vi.fn();
    const resultWindow = {
      closed: true,
      sessionStorage: { setItem },
    } as unknown as Window;

    const result = rerunJob({}, "GenomeAssembly2", { resultWindow });

    // Telling the user to allow pop-ups would be wrong advice for a tab they
    // closed, so the status has to say which happened rather than carrying the
    // closed-tab message under the `blockedPopup` discriminant.
    expect(result).toEqual({
      status: "windowClosed",
      message: rerunWindowClosedMessage,
    });
    expect(result).not.toEqual(
      expect.objectContaining({ message: rerunPopupBlockedMessage }),
    );
    expect(setItem).not.toHaveBeenCalled();
  });

  it("reserves a blank tab, and reports refusal as null", () => {
    const reserved = {};
    mockOpen.mockReturnValue(reserved);
    expect(reserveRerunWindow()).toBe(reserved);
    expect(mockOpen).toHaveBeenCalledWith("", "_blank");

    mockOpen.mockReturnValue(null);
    expect(reserveRerunWindow()).toBeNull();
  });

  it("swallows a close failure so the launch error still reaches the user", () => {
    const close = vi.fn();
    closeRerunWindow({ close } as unknown as Window);
    expect(close).toHaveBeenCalled();

    closeRerunWindow(null);
    expect(() => {
      closeRerunWindow({
        close: () => {
          throw new Error("close failed");
        },
      } as unknown as Window);
    }).not.toThrow();
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
