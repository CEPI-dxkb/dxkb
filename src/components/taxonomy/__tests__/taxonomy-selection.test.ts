import type { RowSelectionState } from "@tanstack/react-table";

import {
  retainSelectedRecords,
  selectRange,
  toggleSelected,
  type TaxonomySelectionRow,
} from "../taxonomy-selection";
import type { TaxonRecord } from "../taxon-tree-types";

function row(id: number, canSelect = true): TaxonomySelectionRow {
  return {
    id: String(id),
    original: {
      taxon_id: id,
      taxon_name: `Taxon ${String(id)}`,
      taxon_rank: "species",
    },
    getCanSelect: () => canSelect,
  };
}

describe("taxonomy selection operations", () => {
  it("toggles a row without mutating the current selection", () => {
    const selected: RowSelectionState = { "1": true };

    expect(toggleSelected(selected, "2")).toEqual({ "1": true, "2": true });
    expect(toggleSelected(selected, "1")).toEqual({});
    expect(selected).toEqual({ "1": true });
  });

  it("selects an inclusive range in either direction and skips disabled rows", () => {
    const rows = [row(1), row(2, false), row(3), row(4)];

    expect(selectRange(rows, "4", "1", { "9": true }, false)).toEqual({
      "1": true,
      "3": true,
      "4": true,
    });
    expect(selectRange(rows, "1", "3", { "9": true }, true)).toEqual({
      "1": true,
      "3": true,
      "9": true,
    });
  });

  it("does not create a range when either endpoint is absent", () => {
    expect(selectRange([row(1)], "1", "2", {}, false)).toBeUndefined();
  });

  it("adds visible selected records, retains hidden selections, and removes deselections", () => {
    const hidden = row(1).original;
    const removed = row(2).original;
    const visible = row(3);
    const retained = new Map<string, TaxonRecord>([
      ["1", hidden],
      ["2", removed],
    ]);

    const records = retainSelectedRecords(retained, { "1": true, "3": true }, [
      visible,
    ]);

    expect([...records.entries()]).toEqual([
      ["1", hidden],
      ["3", visible.original],
    ]);
    expect([...retained.keys()]).toEqual(["1", "2"]);
  });

  it("does not retain a non-selectable visible record", () => {
    expect(
      retainSelectedRecords(new Map(), { "1": true }, [row(1, false)]),
    ).toEqual(new Map());
  });
});
