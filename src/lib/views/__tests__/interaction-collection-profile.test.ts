import { validateRql } from "@/lib/data-api/rql";
import {
  childCollectionOptions,
  parseChildCollectionState,
  replaceChildCollectionSearchParams,
} from "@/lib/views/child-collection-state";
import {
  interactionCollectionOptions,
  interactionCollectionProfile,
  interactionColumns,
  interactionDefaultFilters,
  interactionExtraFilters,
  interactionFacets,
  interactionStructuralRql,
  taxonomyInteractionsRql,
} from "@/lib/views/child-resources";
import {
  facetCountState,
  type CollectionState,
} from "@/lib/views/collection-state";
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
  it("facets category, interaction type, detection method and evidence", () => {
    expect(interactionFacets.map((facet) => facet.field).sort()).toEqual([
      "category",
      "detection_method",
      "evidence",
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
    // The evidence default is in the state beside the focus, as it is for every parse.
    expect(
      parseChildCollectionState(
        { "interactions.interactor": protein },
        "interactions",
        interactionCollectionOptions,
      ).filters,
    ).toEqual({ evidence: ["experimental"], interactor: [protein] });
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
    const scope = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");
    const rql = scopedStructuralRql(scope, interactionStructuralRql)(
      withFilters({ interactor: ["fig|1.1"] }),
    );
    expect(rql).toBe(`and(${scope},${sides("fig%7C1.1")})`);
    expect(() => validateRql("ppi", rql)).not.toThrow();
  });
});

describe("interaction evidence default", () => {
  const parse = (params: Record<string, string | string[]>) =>
    parseChildCollectionState(params, "interactions", interactionCollectionOptions);

  it("defaults evidence to experimental", () => {
    expect(interactionDefaultFilters).toEqual({ evidence: ["experimental"] });
    expect(interactionCollectionOptions.defaultFilters).toBe(
      interactionDefaultFilters,
    );
  });

  it("is the one expression the Table builds its options from", () => {
    // `ResourceChildCollection` builds `childCollectionOptions(profile.columns, profile.facets,
    // defaultSort, defaultFilters, profile.extraFilters)` from the profile and the shell's props;
    // the shell reads the same URL through `interactionCollectionOptions`, so the two must be equal.
    expect(
      childCollectionOptions(
        interactionCollectionProfile.columns,
        interactionCollectionProfile.facets,
        interactionCollectionOptions.defaultSort,
        interactionDefaultFilters,
        interactionCollectionProfile.extraFilters,
      ),
    ).toEqual(interactionCollectionOptions);
  });

  it("applies experimental to an empty URL, and the clause names it", () => {
    const state = parse({});

    expect(state.filters).toEqual({ evidence: ["experimental"] });
    expect(interactionStructuralRql(state)).toBe("eq(evidence,experimental)");
    expect(() =>
      validateRql("ppi", interactionStructuralRql(state) ?? ""),
    ).not.toThrow();
  });

  it("sends the default request the Data API accepts, still naming experimental evidence", () => {
    const scope = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");
    const rql = scopedStructuralRql(scope, interactionStructuralRql)(parse({}));

    expect(rql).toBe(`and(${scope},eq(evidence,experimental))`);
    expect(() => validateRql("ppi", rql)).not.toThrow();
    const removed = scopedStructuralRql(scope, interactionStructuralRql)(
      parse({ "interactions.evidence": "*" }),
    );
    expect(removed).toBe(scope);
    expect(() => validateRql("ppi", removed)).not.toThrow();
  });

  it("applies no evidence term once the default is removed (evidence=*)", () => {
    const state = parse({ "interactions.evidence": "*" });

    expect(state.filters).toEqual({});
    expect(interactionStructuralRql(state)).toBeUndefined();
  });

  it("filters on computational alone when that is picked", () => {
    const state = parse({ "interactions.evidence": "computational" });

    expect(state.filters).toEqual({ evidence: ["computational"] });
    expect(interactionStructuralRql(state)).toBe("eq(evidence,computational)");
  });

  it("ors both values when both are picked", () => {
    const state = parse({
      "interactions.evidence": ["computational", "experimental"],
    });

    expect(state.filters).toEqual({
      evidence: ["computational", "experimental"],
    });
    expect(interactionStructuralRql(state)).toBe(
      "or(eq(evidence,computational),eq(evidence,experimental))",
    );
  });

  it("leaves the default out of the URL and writes the removal as evidence=*", () => {
    const written = (filters: CollectionState["filters"]) =>
      replaceChildCollectionSearchParams(
        {},
        "interactions",
        { ...parse({}), filters },
        interactionCollectionOptions,
      ).toString();

    expect(written({ evidence: ["experimental"] })).toBe("");
    expect(written({})).toBe("interactions.evidence=*");
    expect(written({ evidence: ["computational"] })).toBe(
      "interactions.evidence=computational",
    );
  });

  it("keeps the default beside the other facet picks and the focus", () => {
    const state = parse({
      "interactions.interaction_type": "association",
      "interactions.interactor": "fig|1.1",
    });

    expect(interactionStructuralRql(state)).toBe(
      "and(or(eq(interactor_a,fig%7C1.1),eq(interactor_b,fig%7C1.1)),and(eq(interaction_type,association),eq(evidence,experimental)))",
    );
  });

  it("counts the evidence facet without its own filter, and every facet bare while only the default applies", () => {
    // Untouched defaults are left out of the counts (a default's own facet still lists the values
    // it hides), so Evidence lists both values; with a pick beside the default they stay in.
    expect(
      facetCountState(parse({}), interactionCollectionOptions).filters,
    ).toEqual({});
    expect(
      facetCountState(
        parse({ "interactions.evidence": "computational" }),
        interactionCollectionOptions,
      ).filters,
    ).toEqual({ evidence: ["computational"] });
    expect(
      facetCountState(
        parse({ "interactions.interaction_type": "association" }),
        interactionCollectionOptions,
      ).filters,
    ).toEqual({ interaction_type: ["association"], evidence: ["experimental"] });
  });
});
