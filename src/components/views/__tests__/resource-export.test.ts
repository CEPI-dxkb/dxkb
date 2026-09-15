import type { DataTableColumn } from "@/components/shared/data-table";
import {
  downloadResourceExport,
  serializeResourceRows,
} from "../resource-export";

const columns = [
  { id: "strain", label: "Strain" },
  { id: "genome_ids", label: "Genome IDs" },
] as DataTableColumn[];

describe("serializeResourceRows", () => {
  it("serializes TSV with headers, '; ' arrays, and normalized whitespace", () => {
    expect(
      serializeResourceRows(
        [{ strain: "A/test\nline", genome_ids: ["1.1", "1.2"] }],
        columns,
        ["strain", "genome_ids"],
        "txt",
      ),
    ).toBe("Strain\tGenome IDs\nA/test line\t1.1; 1.2");
  });

  it("uses a caller-supplied array separator (strain copy)", () => {
    expect(
      serializeResourceRows(
        [{ strain: "A/test\nline", genome_ids: ["1.1", "1.2"] }],
        columns,
        ["strain", "genome_ids"],
        "txt",
        true,
        ";",
      ),
    ).toBe("Strain\tGenome IDs\nA/test line\t1.1;1.2");
  });

  it("omits headers and serializes only requested fields", () => {
    expect(
      serializeResourceRows(
        [{ strain: "A/test", genome_ids: ["1.1"] }],
        columns,
        ["strain"],
        "txt",
        false,
      ),
    ).toBe("A/test");
  });

  it("serializes CSV with quoted, comma-joined display-label headers", () => {
    expect(
      serializeResourceRows(
        [{ strain: "A/test, comma", genome_ids: ["1.1", "1.2"] }],
        columns,
        ["strain", "genome_ids"],
        "csv",
      ),
    ).toBe('Strain,Genome IDs\n"A/test, comma","1.1; 1.2"');
  });

  it("falls back to the raw field id when no column defines a label for it", () => {
    expect(
      serializeResourceRows(
        [{ unlabeled: "value" }],
        columns,
        ["unlabeled"],
        "csv",
      ),
    ).toBe('unlabeled\n"value"');
  });

  it.each([
    ["=cmd|' /C calc'!A1", "'=cmd|' /C calc'!A1"],
    ["+1+1", "'+1+1"],
    ["-1+1", "'-1+1"],
    ["@SUM(A1)", "'@SUM(A1)"],
  ])(
    "guards a formula-injection value %s with a leading apostrophe",
    (value, guarded) => {
      expect(
        serializeResourceRows([{ strain: value }], columns, ["strain"], "csv"),
      ).toBe(`Strain\n"${guarded}"`);
    },
  );

  it("doubles embedded double quotes instead of escaping them with a backslash", () => {
    expect(
      serializeResourceRows(
        [{ strain: 'A "quoted" strain' }],
        columns,
        ["strain"],
        "csv",
      ),
    ).toBe('Strain\n"A ""quoted"" strain"');
  });
});

describe("downloadResourceExport", () => {
  function spyOnDownload() {
    let exportedBlob: Blob | undefined;
    let downloadedFilename: string | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exportedBlob = blob as Blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadedFilename = this.download;
      },
    );
    return {
      text: () => exportedBlob?.text(),
      filename: () => downloadedFilename,
    };
  }

  afterEach(() => vi.restoreAllMocks());

  it("names the file after the resource id by default (existing callers keep today's filename)", () => {
    const download = spyOnDownload();
    downloadResourceExport(
      "genome",
      [{ strain: "A" }],
      columns,
      ["strain"],
      "csv",
    );
    expect(download.filename()).toBe("genome.csv");
  });

  it("appends -selected for the selected variant, still keyed off the resource id", () => {
    const download = spyOnDownload();
    downloadResourceExport(
      "genome",
      [{ strain: "A" }],
      columns,
      ["strain"],
      "csv",
      "selected",
    );
    expect(download.filename()).toBe("genome-selected.csv");
  });

  it("uses fileNameBase instead of the resource id when a caller overrides it", () => {
    // This is the one sanctioned override ResourceChildCollection uses (plan
    // item 14) to keep a child export named after its tab label.
    const download = spyOnDownload();
    downloadResourceExport(
      "protein_structure",
      [{ strain: "A" }],
      columns,
      ["strain"],
      "csv",
      "all",
      "domains and motifs",
    );
    expect(download.filename()).toBe("domains and motifs.csv");
  });
});
