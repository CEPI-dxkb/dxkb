import type { DataField } from "../types";
import { strainFields } from "../strain";

const entries: DataField[] = Object.values(strainFields);

describe("strainFields", () => {
  it("all entries have required DataField properties", () => {
    for (const field of entries) {
      expect(typeof field.label).toBe("string");
      expect(typeof field.field).toBe("string");
      expect(typeof field.hidden).toBe("boolean");
      expect(typeof field.group).toBe("string");
    }
  });

  it("field identifiers are unique across all entries", () => {
    const ids = entries.map((f) => f.field);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("show_in_table is false for fields excluded from the data table", () => {
    const excluded = ["taxon_lineage_ids", "taxon_lineage_names"];
    for (const fieldId of excluded) {
      const entry = entries.find((f) => f.field === fieldId);
      expect(entry).toBeDefined();
      expect(entry?.show_in_table).toBe(false);
    }
  });

  it("facet: true on filterable categorical fields", () => {
    const expectedFaceted = [
      "subtype",
      "h_type",
      "n_type",
      "status",
      "host_group",
      "host_common_name",
      "isolation_country",
      "collection_year",
    ];
    for (const fieldId of expectedFaceted) {
      const entry = entries.find((f) => f.field === fieldId);
      expect(entry, `expected ${fieldId} in strainFields`).toBeDefined();
      expect(entry?.facet, `${fieldId} should have facet: true`).toBe(true);
    }
  });

  it("all entries have a search flag (boolean)", () => {
    for (const field of entries) {
      expect(
        typeof field.search,
        `${field.field} missing search flag`,
      ).toBe("boolean");
    }
  });

  it("visible-by-default fields include species, strain, status, host_common_name, isolation_country, collection_date, segment_count", () => {
    const visibleByDefault = [
      "species",
      "strain",
      "status",
      "host_common_name",
      "isolation_country",
      "collection_date",
      "segment_count",
    ];
    for (const fieldId of visibleByDefault) {
      const entry = entries.find((f) => f.field === fieldId);
      expect(entry, `expected ${fieldId} in strainFields`).toBeDefined();
      expect(entry?.hidden, `${fieldId} should be visible by default`).toBe(false);
    }
  });
});
