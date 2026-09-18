import type { DataFieldMap } from "@/constants/datafields/types";
import { overviewGroupFields } from "../overview-group-fields";

const fields: DataFieldMap = {
  test_type: {
    label: "Test Type",
    field: "test_type",
    hidden: false,
    group: "Sample Tests",
  },
  collection_date: {
    label: "Collection Date",
    field: "collection_date",
    hidden: false,
    group: "Sample Collection",
  },
  collection_latitude: {
    label: "Latitude",
    field: "collection_latitude",
    hidden: false,
    group: "Sample Collection",
  },
  collection_city: {
    label: "Collection City",
    field: "collection_city",
    hidden: false,
    group: "Sample Collection",
  },
  serotype: {
    label: "Serotype",
    field: "serotype",
    hidden: false,
    group: "Sample Info",
  },
  sample_identifier: {
    label: "Sample Identifier",
    field: "sample_identifier",
    hidden: false,
    group: "Sample Info",
  },
};

const dateFields = new Set(["collection_date"]);
/** Truncates to the year, so a formatted result is distinguishable from the raw value. */
const formatDate = (value: string) => value.slice(0, 4);

describe("overviewGroupFields", () => {
  it("collects only the requested group", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Tests",
      row: { sample_identifier: "S-1", test_type: "HAI" },
      dateFields,
      formatDate,
    });
    expect(result).toEqual([
      { field: "test_type", label: "Test Type", value: "HAI" },
    ]);
  });

  it("preserves the field map's own order rather than the row's key order", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Info",
      // Row keys deliberately reversed relative to the field map.
      row: { serotype: "H1N1", sample_identifier: "S-1" },
      dateFields,
      formatDate,
    });
    // Declaration order here is reverse-alphabetical, so any sort would show.
    expect(result.map(({ label }) => label)).toEqual([
      "Serotype",
      "Sample Identifier",
    ]);
  });

  it("routes a date field through formatDate and leaves other fields alone", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Collection",
      row: { collection_date: "2021-07-14", collection_city: "2021-07-14" },
      dateFields,
      formatDate,
    });
    expect(result).toEqual([
      { field: "collection_date", label: "Collection Date", value: "2021" },
      {
        field: "collection_city",
        label: "Collection City",
        value: "2021-07-14",
      },
    ]);
  });

  it("drops a date field whose value formats to nothing", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Collection",
      row: { collection_date: "not-a-date" },
      dateFields,
      formatDate: () => null,
    });
    expect(result).toEqual([]);
  });

  it("falls through to ordinary formatting when a date field's value is not a non-empty string", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Collection",
      row: { collection_date: 2021 },
      dateFields,
      formatDate: () => "formatted",
    });
    expect(result).toEqual([
      { field: "collection_date", label: "Collection Date", value: "2021" },
    ]);
  });

  it("drops unavailable values", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Info",
      row: { sample_identifier: "S-1", serotype: null },
      dateFields,
      formatDate,
    });
    expect(result.map(({ label }) => label)).toEqual(["Sample Identifier"]);
  });

  it("drops a value that is available but formats to empty text", () => {
    // [""] passes the availability check (it holds a primitive) but joins to "".
    const result = overviewGroupFields({
      fields,
      group: "Sample Info",
      row: { sample_identifier: "S-1", serotype: [""] },
      dateFields,
      formatDate,
    });
    expect(result.map(({ label }) => label)).toEqual(["Sample Identifier"]);
  });

  it("keeps 0 and false, which are values rather than absences", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Info",
      row: { sample_identifier: 0, serotype: false },
      dateFields,
      formatDate,
    });
    expect(result.map(({ value }) => value)).toEqual(["false", "0"]);
  });

  it("skips excluded fields the caller renders itself", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Collection",
      row: { collection_latitude: "41.88", collection_city: "Chicago" },
      dateFields,
      formatDate,
      exclude: new Set(["collection_latitude"]),
    });
    expect(result.map(({ label }) => label)).toEqual(["Collection City"]);
  });

  it("joins an array value and returns object values as inspectable JSON", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Info",
      row: { sample_identifier: { a: 1 }, serotype: ["H1N1", "H3N2"] },
      dateFields,
      formatDate,
    });
    expect(result.map(({ value }) => value)).toEqual(["H1N1, H3N2", '{"a":1}']);
  });

  it("returns a mutable array the caller can append a combined field to", () => {
    const result = overviewGroupFields({
      fields,
      group: "Sample Collection",
      row: { collection_city: "Chicago" },
      dateFields,
      formatDate,
    });
    result.push({ field: "coordinates", label: "Coordinates", value: "1, 2" });
    expect(result.map(({ label }) => label)).toEqual([
      "Collection City",
      "Coordinates",
    ]);
  });
});
