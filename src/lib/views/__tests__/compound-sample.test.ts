import { resolveCompoundSample } from "../compound-sample";

interface TestRecord {
  sample_identifier: string;
}

function parseTestRecord(row: Record<string, unknown>): TestRecord {
  if (
    typeof row.sample_identifier !== "string" ||
    typeof row.pathogen_test_type !== "string"
  ) {
    throw new Error(`Invalid compound-sample row: ${JSON.stringify(row)}`);
  }
  return { sample_identifier: row.sample_identifier };
}

describe("resolveCompoundSample", () => {
  it("derives ambiguity choices from facets even when the returned rows are invalid", async () => {
    const collection = vi.fn().mockResolvedValue({
      // Neither row satisfies parseTestRecord (missing pathogen_test_type) —
      // these rows are irrelevant to the ambiguous case and must never be parsed.
      rows: [{ id: "1", sample_identifier: "sample" }],
      total: 3,
      facets: {
        pathogen_test_type: [
          { value: "PCR", count: 1 },
          { value: "culture", count: 1 },
          { value: "RAT/antigen", count: 2 },
        ],
      },
      page: 1,
      pageSize: 2,
    });

    await expect(
      resolveCompoundSample(
        { collection },
        {
          resource: "surveillance",
          sampleIdentifier: "sample",
          discriminatorField: "pathogen_test_type",
          parseRecord: parseTestRecord,
        },
      ),
    ).resolves.toEqual({
      status: "ambiguous",
      discriminatorValues: ["PCR", "culture"],
    });
  });

  it("still schema-validates the single row for a unique result", async () => {
    const collection = vi.fn().mockResolvedValue({
      // Missing pathogen_test_type — the one row that will actually be
      // displayed must still be rejected by parseRecord.
      rows: [{ id: "1", sample_identifier: "sample" }],
      total: 1,
      facets: {},
      page: 1,
      pageSize: 2,
    });

    await expect(
      resolveCompoundSample(
        { collection },
        {
          resource: "surveillance",
          sampleIdentifier: "sample",
          discriminatorField: "pathogen_test_type",
          parseRecord: parseTestRecord,
        },
      ),
    ).rejects.toThrow("Invalid compound-sample row");
  });

  it("parses the row for a valid unique result", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        { id: "1", sample_identifier: "sample", pathogen_test_type: "PCR" },
      ],
      total: 1,
      facets: {},
      page: 1,
      pageSize: 2,
    });

    await expect(
      resolveCompoundSample(
        { collection },
        {
          resource: "surveillance",
          sampleIdentifier: "sample",
          discriminatorField: "pathogen_test_type",
          parseRecord: parseTestRecord,
        },
      ),
    ).resolves.toEqual({
      status: "unique",
      record: { sample_identifier: "sample" },
    });
  });
});
