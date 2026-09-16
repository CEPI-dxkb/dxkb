import {
  isSameResourceQuery,
  deriveTableFields,
  downloadLoadedResourceRows,
  findPageRow,
  projectedFields,
} from "../list-data-utils";

afterEach(() => {
  vi.restoreAllMocks();
});

// Guards the placeholderData gate: previous page rows may only carry over when the
// query is still for the same resource. A resource switch (genome → strain) must
// drop the placeholder, else genome rows render under a strain-keyed table and
// collide on React keys (duplicate/undefined `strain` values).
describe("isSameResourceQuery", () => {
  it("returns true when the previous query key's resource matches", () => {
    expect(isSameResourceQuery(["genome-full", "genome", "q"], "genome")).toBe(
      true,
    );
  });

  it("returns false when the resource differs (tab switch)", () => {
    expect(isSameResourceQuery(["genome-full", "genome", "q"], "strain")).toBe(
      false,
    );
  });

  it("returns false when there is no previous query key (first load)", () => {
    expect(isSameResourceQuery(undefined, "genome")).toBe(false);
  });
});

// Fields are derived synchronously from a static registry (not a dynamic import),
// so DataTable can mount with real columns on the first render — no pre-metadata
// skeleton phase, no width regime change from placeholder → real columns.
describe("deriveTableFields", () => {
  it("returns synchronous fields for a known resource", () => {
    const fields = deriveTableFields("genome");
    expect(fields.length).toBeGreaterThan(0);
    expect(
      fields.every(
        (f) => typeof f.id === "string" && typeof f.label === "string",
      ),
    ).toBe(true);
  });

  it("maps hidden:true to visible:false and hidden:false to visible:true", () => {
    const fields = deriveTableFields("genome");
    expect(fields.find((f) => f.id === "genome_name")?.visible).toBe(true);
    expect(fields.find((f) => f.id === "taxon_lineage_ids")?.visible).toBe(
      false,
    );
  });

  it("excludes fields marked show_in_table:false", () => {
    // strain has show_in_table:false entries (e.g. taxon_lineage_ids)
    const fields = deriveTableFields("strain");
    expect(fields.find((f) => f.id === "taxon_lineage_ids")).toBeUndefined();
  });

  // `deriveTableFields` is typed over `DataResource`, so an arbitrary string can
  // no longer reach it. The one remaining miss is a registered resource with no
  // `datafields/*` map — `epitope_assay`, which has no legacy table.
  it("returns a stable empty array for a resource with no table field map", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(deriveTableFields("epitope_assay")).toEqual([]);
    expect(deriveTableFields("epitope_assay")).toBe(
      deriveTableFields("epitope_assay"),
    );
  });

  // The registry is the single source of sortability, and it is the same value
  // `validateSort` enforces at the gateway — so a column that advertises a sort
  // header can never produce a request the gateway rejects. Before this,
  // `deriveTableFields` emitted no `sortable` at all and every column claimed
  // server sorting.
  it("reports a column the registry declares unsortable as unsortable", () => {
    // genome_feature.go and experiment.experimenters both carry an explicit
    // `sortable: false` in their datafields entry and are still table columns.
    expect(
      deriveTableFields("genome_feature").find((f) => f.id === "go")?.sortable,
    ).toBe(false);
    expect(
      deriveTableFields("experiment").find((f) => f.id === "experimenters")
        ?.sortable,
    ).toBe(false);
    // A neighbouring column with no flag still sorts, so this is not just
    // "nothing is sortable".
    expect(
      deriveTableFields("genome_feature").find((f) => f.id === "property")
        ?.sortable,
    ).toBe(true);
  });

  it("reports a multiple-valued column as unsortable even without a sortable flag", () => {
    // strain.genome_ids has no `sortable` flag; the registry derives it from
    // declared cardinality (`multipleFields`), which Solr cannot sort on.
    const strain = deriveTableFields("strain");
    expect(strain.find((f) => f.id === "genome_ids")?.sortable).toBe(false);
    expect(strain.find((f) => f.id === "genbank_accessions")?.sortable).toBe(
      false,
    );
    // A scalar column on the same resource still sorts.
    expect(strain.find((f) => f.id === "strain")?.sortable).toBe(true);
  });

  it("reports the AMR publication list as unsortable and its scalar columns as sortable", () => {
    const amr = deriveTableFields("genome_amr");
    expect(amr.find((f) => f.id === "pmid")?.sortable).toBe(false);
    expect(amr.find((f) => f.id === "antibiotic")?.sortable).toBe(true);
  });
});

// Regression: row click used to fire a fresh detail-panel fetch on every selection
// because the TanStack Query cache had no entry for the new row. The fix pre-populates
// the cache from pageData in handleRowSelectionChange. findPageRow is the lookup that
// decides whether pre-population fires — if it's broken (returns undefined), the
// setQueryData call is skipped and the loading flash returns.
// Regression: genome_sequence API returns the raw `sequence` DNA field by default,
// inflating each page response from ~80KB to ~18MB. The fix restricts fetches to the
// fields defined in genomeSequenceFields. Confirm `sequence` stays out of that map.
describe("genome_sequence field registry", () => {
  it("does not include the raw 'sequence' DNA field — its absence prevents 18MB responses", () => {
    const fields = deriveTableFields("genome_sequence");
    expect(fields.map((f) => f.id)).not.toContain("sequence");
  });

  it("includes the key table fields for genome_sequence", () => {
    const fields = deriveTableFields("genome_sequence");
    const ids = fields.map((f) => f.id);
    expect(ids).toContain("sequence_id");
    expect(ids).toContain("genome_id");
    expect(ids).toContain("accession");
    expect(ids).toContain("gc_content");
    expect(ids).toContain("length");
  });
});

// The projection sent with every row read. It is deliberately wider than the
// visible columns: the detail panel renders `show_in_table: false` fields too.
describe("projectedFields", () => {
  it("always includes the identity field", () => {
    expect(projectedFields("genome_sequence", "sequence_id")).toContain(
      "sequence_id",
    );
    expect(projectedFields("genome_amr", "id")).toContain("id");
  });

  // Regression: the genome_sequence core returns the raw `sequence` DNA field
  // by default, inflating a page from ~80KB to ~18MB. The projection is what
  // keeps it out.
  it("omits the raw genome_sequence DNA column", () => {
    expect(projectedFields("genome_sequence", "sequence_id")).not.toContain(
      "sequence",
    );
  });

  // Regression: serologyFields declares `date_modified` and `date_inserted`;
  // there is no `date_updated` field, so the projection must never name it.
  it("uses serology's real date columns, not the dead date_updated name", () => {
    const fields = projectedFields("serology", "id");
    expect(fields).toContain("date_modified");
    expect(fields).toContain("date_inserted");
    expect(fields).not.toContain("date_updated");
  });

  it("includes both interactor sides for ppi", () => {
    const fields = projectedFields("ppi", "id");
    expect(fields).toContain("genome_id_a");
    expect(fields).toContain("interactor_a");
    expect(fields).toContain("genome_id_b");
    expect(fields).toContain("interactor_b");
  });
});

describe("downloadLoadedResourceRows", () => {
  function captureDownload() {
    let blob: Blob | undefined;
    let filename: string | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      blob = value as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        filename = this.download;
      },
    );
    return {
      text: () => blob?.text(),
      filename: () => filename,
    };
  }

  it("writes only the exported columns and omits the selection column", async () => {
    const download = captureDownload();

    downloadLoadedResourceRows({
      resource: "genome",
      rows: [{ genome_id: "1", genome_name: "Example" }],
      format: "csv",
      visibleColumns: ["__select__", "genome_id", "genome_name"],
      fields: [
        { id: "genome_id", label: "Genome ID", visible: true, sortable: true },
        {
          id: "genome_name",
          label: "Genome Name",
          visible: true,
          sortable: true,
        },
      ],
    });

    await expect(download.text()).resolves.toBe(
      'Genome ID,Genome Name\n"1","Example"',
    );
    expect(download.filename()).toBe("genome-all.csv");
  });

  it("neutralizes CSV formulas and keeps each value on one row", async () => {
    const download = captureDownload();

    downloadLoadedResourceRows({
      resource: "genome",
      rows: [{ genome_id: '=1+1\r\n"quoted"' }],
      format: "csv",
      visibleColumns: ["genome_id"],
      fields: [
        { id: "genome_id", label: "Genome ID", visible: true, sortable: true },
      ],
    });

    await expect(download.text()).resolves.toBe(
      'Genome ID\n"\'=1+1 ""quoted"""',
    );
  });

  it("writes headers only for an empty displayed-column selection", async () => {
    const download = captureDownload();

    downloadLoadedResourceRows({
      resource: "genome",
      rows: [{ genome_id: "1" }],
      format: "csv",
      visibleColumns: [],
      fields: [
        { id: "genome_id", label: "Genome ID", visible: true, sortable: true },
      ],
    });

    await expect(download.text()).resolves.toBe("\n");
  });
});

describe("findPageRow", () => {
  const rows = [
    { sequence_id: "abc.1", length: 100 },
    { sequence_id: "def.2", length: 200 },
    { sequence_id: "42", length: 300 },
  ];

  it("returns the matching row when the id is present", () => {
    expect(findPageRow(rows, "sequence_id", "def.2")).toEqual({
      sequence_id: "def.2",
      length: 200,
    });
  });

  it("returns undefined when the id is not in pageData", () => {
    expect(findPageRow(rows, "sequence_id", "not-there")).toBeUndefined();
  });

  it("coerces non-string id field values to string for comparison", () => {
    // API rows may carry numeric ids (e.g. taxon_id: 234). String(234) === "234".
    const numericRows = [{ taxon_id: 234, name: "Brucella" }];
    expect(findPageRow(numericRows, "taxon_id", "234")).toEqual({
      taxon_id: 234,
      name: "Brucella",
    });
  });

  it("returns undefined for an empty pageData array", () => {
    expect(findPageRow([], "sequence_id", "abc.1")).toBeUndefined();
  });
});
