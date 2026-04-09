import { resolveViewer, iframeNeedsScripts } from "../file-viewer-registry";

// Test the viewer routing logic that FileViewerContent depends on.
// The component itself is a thin switch over resolveViewer, so we test
// the routing decisions here rather than rendering the full component
// (which requires heavy viewer mocks).

describe("FileViewerContent routing logic", () => {
  it("routes .fasta files to text viewer", () => {
    expect(resolveViewer("contigs", "reads.fasta")).toBe("text");
  });

  it("routes .json files to json viewer", () => {
    expect(resolveViewer("json", "config.json")).toBe("json");
  });

  it("routes .png files to image viewer", () => {
    expect(resolveViewer("png", "photo.png")).toBe("image");
  });

  it("routes .svg files to svg viewer", () => {
    expect(resolveViewer("svg", "diagram.svg")).toBe("svg");
  });

  it("routes .csv files to csv viewer", () => {
    expect(resolveViewer("csv", "data.csv")).toBe("csv");
  });

  it("routes .tsv files to csv viewer", () => {
    expect(resolveViewer("tsv", "data.tsv")).toBe("csv");
  });

  it("routes .pdf files to iframe viewer", () => {
    expect(resolveViewer("pdf", "document.pdf")).toBe("iframe");
  });

  it("routes .html files to iframe viewer", () => {
    expect(resolveViewer("html", "report.html")).toBe("iframe");
  });

  it("routes .htm files to iframe viewer", () => {
    expect(resolveViewer("html", "report.htm")).toBe("iframe");
  });

  it("routes .pdb files to text viewer (3D viewed in dedicated page)", () => {
    expect(resolveViewer("pdb", "model.pdb")).toBe("text");
  });

  it("routes pdb workspace type to text", () => {
    expect(resolveViewer("pdb", "noext")).toBe("text");
  });

  it("routes unknown types to fallback", () => {
    expect(resolveViewer("genome_group", "unknown.xyz")).toBe("fallback");
  });

  describe("iframeNeedsScripts", () => {
    it("returns true for PDF files", () => {
      expect(iframeNeedsScripts("document.pdf")).toBe(true);
    });

    it("returns true for HTML files", () => {
      expect(iframeNeedsScripts("page.html")).toBe(true);
    });

    it("returns true for HTM files", () => {
      expect(iframeNeedsScripts("page.htm")).toBe(true);
    });

    it("returns false for PDB files", () => {
      expect(iframeNeedsScripts("model.pdb")).toBe(false);
    });
  });
});
