import { metadataFieldLabel } from "@/lib/services/organisms/metadata-field-labels";

describe("metadataFieldLabel", () => {
  it.each([
    ["isolation_country", "Isolation Country"],
    ["host_common_name", "Host Distribution"],
    ["collection_year", "Collection Year"],
  ])("calls %s by its chart title, %s", (field, label) => {
    expect(metadataFieldLabel(field)).toBe(label);
  });

  it("keeps the name of a field it has no title for", () => {
    expect(metadataFieldLabel("antimicrobial_resistance")).toBe(
      "antimicrobial_resistance",
    );
  });
});
