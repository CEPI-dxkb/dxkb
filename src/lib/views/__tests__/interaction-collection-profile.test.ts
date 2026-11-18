import { validateRql } from "@/lib/data-api/rql";
import {
  interactionCollectionProfile,
  interactionColumns,
  interactionFacets,
} from "@/lib/views/child-resources";
import type { CollectionState } from "@/lib/views/collection-state";

const withFilters = (filters: CollectionState["filters"]): CollectionState => ({
  filters,
  page: 1,
  sort: "id:asc",
});

describe("interactionCollectionProfile", () => {
  it("facets interaction type, detection method and category, never evidence", () => {
    expect(interactionFacets.map((facet) => facet.field).sort()).toEqual([
      "category",
      "detection_method",
      "interaction_type",
    ]);
    expect(interactionCollectionProfile.facets).toBe(interactionFacets);
  });

  it("keeps the columns the Table already shows", () => {
    expect(interactionCollectionProfile.columns).toBe(interactionColumns);
    expect(interactionCollectionProfile.resource).toBe("ppi");
    expect(interactionCollectionProfile.idField).toBe("id");
  });

  it("builds no clause without filters", () => {
    expect(
      interactionCollectionProfile.buildStructuralRql?.(withFilters({})),
    ).toBeUndefined();
  });

  it("ors values within a field and ands across fields", () => {
    const clause = interactionCollectionProfile.buildStructuralRql?.(
      withFilters({
        interaction_type: ["physical association", "physical interaction"],
        detection_method: ["pull down"],
      }),
    );
    expect(clause).toMatch(/^and\(or\(.*\),.*\)$/);
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });

  it("accepts a value containing parentheses (real BV-BRC value)", () => {
    const clause = interactionCollectionProfile.buildStructuralRql?.(
      withFilters({
        interaction_type: ["intact:ia:2752(sulfurtransferase reaction"],
      }),
    );
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });
});
