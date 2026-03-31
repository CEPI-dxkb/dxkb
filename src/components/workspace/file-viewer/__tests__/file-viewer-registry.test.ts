import {
  resolveViewer,
  isViewableType,
  getMimeType,
  getProxyUrl,
  getPreviewUrl,
  previewMaxBytes,
} from "../file-viewer-registry";

describe("resolveViewer", () => {
  it("resolves .fasta to text via extension", () => {
    expect(resolveViewer("contigs", "SRR29455647.fasta")).toBe("text");
  });

  it("resolves .json to json via extension", () => {
    expect(resolveViewer("unknown", "data.json")).toBe("json");
  });

  it("resolves .csv to csv via extension", () => {
    expect(resolveViewer("unknown", "results.csv")).toBe("csv");
  });

  it("resolves .png to image via extension", () => {
    expect(resolveViewer("unknown", "photo.png")).toBe("image");
  });

  it("resolves .svg to svg via extension", () => {
    expect(resolveViewer("unknown", "diagram.svg")).toBe("svg");
  });

  it("resolves .pdf to iframe via extension", () => {
    expect(resolveViewer("unknown", "document.pdf")).toBe("iframe");
  });

  it("resolves .pdb to text via extension (3D viewed in dedicated page)", () => {
    expect(resolveViewer("unknown", "model.pdb")).toBe("text");
  });

  it("resolves pdb workspace type to text", () => {
    expect(resolveViewer("pdb", "noext")).toBe("text");
  });

  it("falls back to workspace type when no extension match", () => {
    expect(resolveViewer("aligned_dna_fasta", "noext")).toBe("text");
  });

  it("returns fallback for unknown type and extension", () => {
    expect(resolveViewer("unknown_type", "file.xyz")).toBe("fallback");
  });

  it("does not use file size in routing (pure type-based)", () => {
    // resolveViewer has no size parameter — routing is type-only
    expect(resolveViewer("contigs", "big.fasta")).toBe("text");
    expect(resolveViewer("json", "big.json")).toBe("json");
    expect(resolveViewer("csv", "big.csv")).toBe("csv");
  });
});

describe("isViewableType", () => {
  it("returns true for viewable types", () => {
    expect(isViewableType("contigs", "file.fasta")).toBe(true);
    expect(isViewableType("json", "file.json")).toBe(true);
  });

  it("returns false for unknown types", () => {
    expect(isViewableType("unknown", "file.xyz")).toBe(false);
  });
});

describe("getMimeType", () => {
  it("returns correct MIME for known extensions", () => {
    expect(getMimeType("file.fasta")).toBe("text/plain");
    expect(getMimeType("file.json")).toBe("application/json");
    expect(getMimeType("file.pdf")).toBe("application/pdf");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(getMimeType("file.xyz")).toBe("application/octet-stream");
  });
});

describe("getProxyUrl", () => {
  it("builds encoded view URL (keeps @ unencoded)", () => {
    expect(getProxyUrl("/user@bvbrc/home/file.fasta")).toBe(
      "/api/workspace/view/user@bvbrc/home/file.fasta",
    );
  });
});

describe("getPreviewUrl", () => {
  it("builds preview URL with default maxBytes", () => {
    const url = getPreviewUrl("/user@bvbrc/home/file.fasta");
    expect(url).toBe(
      `/api/workspace/preview/user@bvbrc/home/file.fasta?maxBytes=${previewMaxBytes}`,
    );
  });

  it("builds preview URL with custom maxBytes", () => {
    const url = getPreviewUrl("/user@bvbrc/home/file.fasta", 2048);
    expect(url).toBe(
      "/api/workspace/preview/user@bvbrc/home/file.fasta?maxBytes=2048",
    );
  });
});
