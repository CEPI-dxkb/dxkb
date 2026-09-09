import type { DataTableColumn } from "@/components/shared/data-table";
import { serializeResourceRows } from "../resource-export";

const columns = [
  { id: "strain", label: "Strain" },
  { id: "genome_ids", label: "Genome IDs" },
] as DataTableColumn[];

describe("serializeResourceRows", () => {
  it("serializes TSV with headers, semicolon arrays, and normalized whitespace", () => {
    expect(
      serializeResourceRows(
        [{ strain: "A/test\nline", genome_ids: ["1.1", "1.2"] }],
        columns,
        ["strain", "genome_ids"],
        "txt",
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
});
