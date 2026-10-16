import {
  downloadFileName,
  downloadFileNameBase,
  downloadFormatIds,
  downloadFormats,
  downloadFormatsFor,
  downloadRowCount,
  downloadUnavailableReason,
  emptyDownloadMessage,
  maxBufferedDownloadRows,
  maxDownloadRequestBytes,
  maxExcelRows,
  maxQueryDownloadRows,
  maxSelectionDownloadRows,
  maxSequenceQueryRows,
  queryDownloadRowLimit,
  resolveCollectionDownloadSpec,
  sequenceDownloadFor,
  sequenceDownloads,
  sequenceTypeOfFormat,
  unselectableColumnsReason,
  unselectableFields,
  usesNativeDownload,
  type DownloadFormatId,
  type DownloadRequest,
} from "../downloads";
import { isFastaResource, supportsFastaType } from "../fasta";
import { dataResources, maxRequestBytes, type DataResource } from "../types";

describe("download formats per resource", () => {
  // The BV-BRC inventory (plan §1.2) as data: every resource offers the table
  // formats, and these three add sequences.
  const sequenceMatrix: Partial<Record<DataResource, DownloadFormatId[]>> = {
    genome: ["dna-fasta"],
    genome_feature: ["dna-fasta", "protein-fasta"],
    genome_sequence: ["dna-fasta"],
  };

  it.each(dataResources)("offers %s exactly its legacy formats", (resource) => {
    expect(downloadFormatsFor(resource)).toStrictEqual([
      "tsv",
      "csv",
      "xlsx",
      ...(sequenceMatrix[resource] ?? []),
    ]);
  });

  it("reads every sequence format from a resource fastaResources serves in that type", () => {
    for (const [resource, entry] of Object.entries(sequenceDownloads)) {
      const source = "via" in entry ? entry.via.resource : resource;
      expect(isFastaResource(source)).toBe(true);
      for (const format of entry.formats) {
        expect(
          isFastaResource(source) &&
            supportsFastaType(source, sequenceTypeOfFormat[format]),
        ).toBe(true);
      }
    }
  });

  it("downloads a genome's DNA as its contigs", () => {
    expect(sequenceDownloadFor("genome")?.via).toStrictEqual({
      resource: "genome_sequence",
      key: "genome_id",
      sort: "sequence_id",
      note: "Contigs of each genome",
    });
    // A prototype key must not pass as a resource.
    expect(sequenceDownloadFor("toString" as DataResource)).toBeUndefined();
  });

  it("names each format's upstream Accept type", () => {
    expect(
      Object.fromEntries(
        downloadFormatIds.map((id) => [id, downloadFormats[id].accept]),
      ),
    ).toStrictEqual({
      tsv: "text/tsv",
      csv: "text/csv",
      xlsx: "application/vnd.openxmlformats",
      "dna-fasta": "application/dna+fasta",
      "protein-fasta": "application/protein+fasta",
    });
  });
});

describe("resolveCollectionDownloadSpec", () => {
  it("fills in the resource defaults when a view declares nothing", () => {
    expect(resolveCollectionDownloadSpec("genome")).toStrictEqual({
      tableFormats: ["tsv", "csv", "xlsx"],
      sequenceFormats: ["dna-fasta"],
      enabled: true,
      sequenceNote: "Contigs of each genome",
    });
    expect(resolveCollectionDownloadSpec("epitope")).toMatchObject({
      sequenceFormats: [],
      sequenceNote: undefined,
    });
  });

  it("narrows a Proteins view to Protein FASTA", () => {
    expect(
      resolveCollectionDownloadSpec("genome_feature", {
        sequenceFormats: ["protein-fasta"],
      }).sequenceFormats,
    ).toStrictEqual(["protein-fasta"]);
  });

  it("drops a sequence format the resource does not serve", () => {
    expect(
      resolveCollectionDownloadSpec("genome_sequence", {
        sequenceFormats: ["dna-fasta", "protein-fasta"],
      }).sequenceFormats,
    ).toStrictEqual(["dna-fasta"]);
    expect(
      resolveCollectionDownloadSpec("strain", {
        sequenceFormats: ["dna-fasta"],
      }).sequenceFormats,
    ).toStrictEqual([]);
  });

  it("can hide the tile", () => {
    expect(
      resolveCollectionDownloadSpec("strain", { enabled: false }).enabled,
    ).toBe(false);
  });
});

describe("downloadUnavailableReason", () => {
  const reason = (
    format: DownloadFormatId,
    scope: "selected" | "all",
    rows: number,
  ) => downloadUnavailableReason({ format, scope, rows });

  it("needs at least one row", () => {
    expect(reason("csv", "selected", 0)).toBe("Select rows first");
    expect(reason("csv", "all", 0)).toBe("No matching rows");
    expect(reason("csv", "all", 1)).toBeNull();
  });

  it("caps a selection at one upstream in() request", () => {
    expect(maxSelectionDownloadRows).toBe(10_000);
    expect(reason("csv", "selected", 10_000)).toBeNull();
    expect(reason("csv", "selected", 10_001)).toBe(
      "Selections: 10,000 rows at most",
    );
  });

  it("caps a query at legacy's limit", () => {
    expect(maxQueryDownloadRows).toBe(2_500_000);
    expect(reason("tsv", "all", 2_500_000)).toBeNull();
    expect(reason("tsv", "all", 2_500_001)).toBe(
      "Over 2,500,000 rows: narrow the filters",
    );
  });

  it("keeps Excel inside one sheet", () => {
    expect(maxExcelRows).toBe(1_048_575);
    expect(reason("xlsx", "all", 1_048_575)).toBeNull();
    expect(reason("xlsx", "all", 1_048_576)).toBe(
      "Over Excel's 1,048,576-row limit",
    );
    expect(reason("csv", "all", 1_048_576)).toBeNull();
  });

  it("caps all-results sequences, which a selection never reaches", () => {
    expect(maxSequenceQueryRows).toBe(10_000);
    expect(reason("dna-fasta", "all", 10_000)).toBeNull();
    expect(reason("protein-fasta", "all", 10_001)).toBe(
      "Sequences: 10,000 rows at most",
    );
    expect(reason("protein-fasta", "selected", 10_000)).toBeNull();
  });
});

describe("unselectable columns", () => {
  it("are the fields whose name starts with a digit", () => {
    expect(unselectableFields(["strain", "1_pb2", "h_type", "8_ns"])).toEqual([
      "1_pb2",
      "8_ns",
    ]);
  });

  it("name up to two of them in the reason", () => {
    expect(unselectableColumnsReason(["strain", "h_type"])).toBeNull();
    expect(unselectableColumnsReason(["strain", "1_pb2"])).toBe(
      "The data service cannot select 1_pb2",
    );
    expect(unselectableColumnsReason(["1_pb2", "4_ha"])).toBe(
      "The data service cannot select 1_pb2 and 4_ha",
    );
    expect(unselectableColumnsReason(["1_pb2", "2_pb1", "4_ha", "8_ns"])).toBe(
      "The data service cannot select 1_pb2, 2_pb1 and 2 more",
    );
  });

  it("refuse an empty list, which would download every field", () => {
    expect(unselectableColumnsReason([])).toBe("No columns are visible");
  });
});

describe("queryDownloadRowLimit", () => {
  it.each(downloadFormatIds)(
    "is the most rows an all-results %s download may hold",
    (format) => {
      const limit = queryDownloadRowLimit(format);
      expect(
        downloadUnavailableReason({ format, scope: "all", rows: limit }),
      ).toBeNull();
      expect(
        downloadUnavailableReason({ format, scope: "all", rows: limit + 1 }),
      ).not.toBeNull();
    },
  );
});

describe("download file names", () => {
  it.each(downloadFormatIds.flatMap((format) =>
    (["all", "selected"] as const).map((scope) => ({ format, scope })),
  ))("names a $scope $format download", ({ format, scope }) => {
    const extension = {
      tsv: "txt",
      csv: "csv",
      xlsx: "xlsx",
      "dna-fasta": "dna.fasta",
      "protein-fasta": "protein.fasta",
    }[format];
    expect(
      downloadFileName(downloadFileNameBase("genome_feature", scope), format),
    ).toBe(
      scope === "selected"
        ? `genome_feature-selected.${extension}`
        : `genome_feature.${extension}`,
    );
  });

  it("makes the base safe and never leaves it empty", () => {
    expect(downloadFileName("fig|1.1.peg.1", "csv")).toBe("fig_1.1.peg.1.csv");
    expect(downloadFileName("..", "tsv")).toBe("download.txt");
    expect(downloadFileName("domains and motifs", "xlsx")).toBe(
      "domains and motifs.xlsx",
    );
  });

  it("prefixes a Windows device name, which no file may take", () => {
    expect(downloadFileName("CON", "csv")).toBe("_CON.csv");
    expect(downloadFileName("nul.x", "tsv")).toBe("_nul.x.txt");
    expect(downloadFileName("lpt1", "xlsx")).toBe("_lpt1.xlsx");
    expect(downloadFileName("console", "csv")).toBe("console.csv");
    expect(downloadFileName("com10", "csv")).toBe("com10.csv");
  });
});

describe("download transport choice", () => {
  const request = (
    scope: DownloadRequest["scope"],
    total: number,
    format: DownloadFormatId = "tsv",
  ): DownloadRequest => ({
    format,
    scope,
    fileNameBase: "genome",
    total,
  });

  it("streams a query over the buffered limit to disk", () => {
    expect(maxBufferedDownloadRows).toBe(10_000);
    expect(usesNativeDownload("genome", request({ kind: "query" }, 10_000))).toBe(
      false,
    );
    expect(usesNativeDownload("genome", request({ kind: "query" }, 10_001))).toBe(
      true,
    );
    expect(
      usesNativeDownload(
        "genome",
        request({ kind: "selected", ids: ["1"] }, 20_000),
      ),
    ).toBe(false);
  });

  it("streams whole contigs to disk at any row count, since rows do not bound their size", () => {
    const one: DownloadRequest["scope"] = { kind: "selected", ids: ["1.1"] };
    expect(usesNativeDownload("genome", request(one, 1, "dna-fasta"))).toBe(true);
    expect(
      usesNativeDownload("genome", request({ kind: "query" }, 2, "dna-fasta")),
    ).toBe(true);
    expect(
      usesNativeDownload("genome_sequence", request(one, 1, "dna-fasta")),
    ).toBe(true);
    // A genome's table, and a feature's own sequence, stay small.
    expect(usesNativeDownload("genome", request(one, 1, "csv"))).toBe(false);
    expect(
      usesNativeDownload(
        "genome_feature",
        request({ kind: "query" }, 10_000, "protein-fasta"),
      ),
    ).toBe(false);
    expect(
      Object.entries(sequenceDownloads)
        .filter(([, download]) => "unboundedSize" in download)
        .map(([resource]) => resource),
    ).toEqual(["genome", "genome_sequence"]);
  });

  it("counts a selection by its ids and a query by its total", () => {
    expect(
      downloadRowCount({ scope: { kind: "selected", ids: ["a", "b"] }, total: 9 }),
    ).toBe(2);
    expect(downloadRowCount({ scope: { kind: "query" }, total: 9 })).toBe(9);
  });

  it("admits 10,000 long feature ids in one download body", () => {
    const ids = Array.from(
      { length: maxSelectionDownloadRows },
      (_, index) => `PATRIC.11320.104417.MK788327.CDS.26.1726.fwd.${String(index)}`,
    );
    const body = JSON.stringify(request({ kind: "selected", ids }, ids.length));
    expect(new TextEncoder().encode(body).length).toBeLessThan(
      maxDownloadRequestBytes,
    );
    expect(maxDownloadRequestBytes).toBeGreaterThan(maxRequestBytes);
  });
});

describe("emptyDownloadMessage", () => {
  it("names what an empty file lacked", () => {
    expect(emptyDownloadMessage("protein-fasta")).toBe(
      "No protein sequence is available for the requested records.",
    );
    expect(emptyDownloadMessage("dna-fasta")).toBe(
      "No DNA sequence is available for the requested records.",
    );
    expect(emptyDownloadMessage("csv")).toBe("No records matched the download.");
  });
});
