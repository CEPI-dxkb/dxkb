import { validateRql } from "@/lib/data-api/rql";
import { parseChildCollectionState } from "@/lib/views/child-collection-state";
import {
  interactionCollectionOptions,
  interactionCollectionProfile,
  interactionColumns,
  interactionExtraFilters,
  interactionFacets,
  interactionStructuralRql,
} from "@/lib/views/child-resources";
import type { CollectionState } from "@/lib/views/collection-state";
import { scopedStructuralRql } from "@/lib/views/scoped-structural-rql";

const withFilters = (filters: CollectionState["filters"]): CollectionState => ({
  filters,
  page: 1,
  sort: "id:asc",
});

/** Throws when the profile has no builder, so a missing one cannot pass a test through `?.`. */
function buildClause(filters: CollectionState["filters"]): string | undefined {
  const { buildStructuralRql } = interactionCollectionProfile;
  if (!buildStructuralRql) {
    throw new Error("The interaction profile has no buildStructuralRql.");
  }
  return buildStructuralRql(withFilters(filters));
}

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
    expect(typeof interactionCollectionProfile.buildStructuralRql).toBe(
      "function",
    );
    expect(buildClause({})).toBeUndefined();
  });

  it("ors values within a field and ands across fields", () => {
    const clause = buildClause({
      interaction_type: ["physical association", "physical interaction"],
      detection_method: ["pull down"],
    });
    expect(clause).toMatch(/^and\(or\(.*\),.*\)$/);
    expect(clause).toContain("interaction_type");
    expect(clause).toContain("detection_method");
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });

  it("accepts a value containing parentheses (real BV-BRC value)", () => {
    const clause = buildClause({
      interaction_type: ["intact:ia:2752(sulfurtransferase reaction"],
    });
    expect(clause).toContain("interaction_type");
    // The parenthesis is escaped, so the value survives inside its clause.
    expect(clause).toContain("%28");
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });
});

describe("interaction focus filter", () => {
  const protein = "fig|224914.16.peg.635";
  const sides = (id: string) =>
    `or(eq(interactor_a,${id}),eq(interactor_b,${id}))`;

  it("is a URL filter beside the facets, not a facet", () => {
    expect(interactionExtraFilters).toEqual(["interactor"]);
    expect(interactionCollectionProfile.extraFilters).toBe(
      interactionExtraFilters,
    );
    // Every facet field gets a count query, and `interactor` is not a counted
    // field, so listing it there would turn the counts into a 400.
    expect(
      interactionCollectionProfile.facets?.map((facet) => facet.field),
    ).not.toContain("interactor");
    expect(interactionCollectionProfile.filterLabels).toEqual({
      interactor: "Protein",
    });
  });

  it("has options the shell and the Table both build, naming the filter", () => {
    expect(interactionCollectionOptions.friendlyFilters).toEqual([
      ...interactionFacets.map((facet) => facet.field),
      "interactor",
    ]);
    expect(interactionCollectionOptions.defaultSort).toBe("id:asc");
    expect(
      parseChildCollectionState(
        { "interactions.interactor": protein },
        "interactions",
        interactionCollectionOptions,
      ).filters,
    ).toEqual({ interactor: [protein] });
  });

  it("is the profile's builder", () => {
    expect(interactionCollectionProfile.buildStructuralRql).toBe(
      interactionStructuralRql,
    );
  });

  it("matches the protein on either side of an interaction", () => {
    const clause = interactionStructuralRql(
      withFilters({ interactor: [protein] }),
    );
    expect(clause).toBe(sides("fig%7C224914.16.peg.635"));
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });

  it("never sends the filter name as a field", () => {
    const clause = interactionStructuralRql(
      withFilters({ interactor: [protein] }),
    );
    expect(clause).not.toContain("eq(interactor,");
    expect(clause).not.toContain("(interactor,");
  });

  it("ands the focus with the facet picks", () => {
    const clause = interactionStructuralRql(
      withFilters({
        interactor: ["fig|1.1"],
        interaction_type: ["association"],
      }),
    );
    expect(clause).toBe(
      `and(${sides("fig%7C1.1")},eq(interaction_type,association))`,
    );
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });

  it("builds nothing for an empty or blank focus", () => {
    expect(interactionStructuralRql(withFilters({ interactor: [""] }))).toBe(
      undefined,
    );
    expect(interactionStructuralRql(withFilters({ interactor: [] }))).toBe(
      undefined,
    );
    expect(
      interactionStructuralRql(
        withFilters({ interactor: [""], interaction_type: ["association"] }),
      ),
    ).toBe("eq(interaction_type,association)");
  });

  it("accepts ids holding a pipe or a colon", () => {
    for (const id of ["fig|1.1", "intact:EBI-123", "uniprot:P0A7B8|x"]) {
      const clause = interactionStructuralRql(withFilters({ interactor: [id] }));
      expect(clause).toContain("interactor_a");
      expect(clause).toContain("interactor_b");
      expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
    }
  });

  it("ors several proteins, each over both sides", () => {
    const clause = interactionStructuralRql(
      withFilters({ interactor: ["fig|1.1", "fig|2.2"] }),
    );
    expect(clause).toBe(
      `or(${sides("fig%7C1.1")},${sides("fig%7C2.2")})`,
    );
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });

  it("narrows the scope the way the Table and the Graph both send it", () => {
    const scope = "eq(evidence,experimental)";
    const rql = scopedStructuralRql(scope, interactionStructuralRql)(
      withFilters({ interactor: ["fig|1.1"] }),
    );
    expect(rql).toBe(`and(${scope},${sides("fig%7C1.1")})`);
    expect(() => validateRql("ppi", rql)).not.toThrow();
  });
});
