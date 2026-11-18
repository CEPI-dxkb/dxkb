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
    // Evidence has no default, so the focus is the only filter a bare focus URL parses to.
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
    const scope = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");
    const rql = scopedStructuralRql(scope, interactionStructuralRql)(
      withFilters({ interactor: ["fig|1.1"] }),
    );
    expect(rql).toBe(`and(${scope},${sides("fig%7C1.1")})`);
    expect(() => validateRql("ppi", rql)).not.toThrow();
  });
});

describe("interaction evidence facet (no default)", () => {
  const parse = (params: Record<string, string | string[]>) =>
    parseChildCollectionState(params, "interactions", interactionCollectionOptions);

  it("has no default filter, so the default view lists every interaction", () => {
    expect(interactionCollectionOptions.defaultFilters).toBeUndefined();
    // Evidence is still a facet the Filters menu offers.
    expect(interactionCollectionOptions.friendlyFilters).toContain("evidence");
    expect(interactionFacets.map((facet) => facet.field)).toContain("evidence");
  });

  it("is the one expression the Table builds its options from", () => {
    // `ResourceChildCollection` builds `childCollectionOptions(profile.columns, profile.facets,
    // defaultSort, defaultFilters, profile.extraFilters)` from the profile and the shell's props
    // (it passes no `defaultFilters`); the shell reads the same URL through
    // `interactionCollectionOptions`, so the two must be equal.
    expect(
      childCollectionOptions(
        interactionCollectionProfile.columns,
        interactionCollectionProfile.facets,
        interactionCollectionOptions.defaultSort,
        undefined,
        interactionCollectionProfile.extraFilters,
      ),
    ).toEqual(interactionCollectionOptions);
  });

  it("applies no evidence term to an empty URL", () => {
    const state = parse({});

    expect(state.filters).toEqual({});
    expect(interactionStructuralRql(state)).toBeUndefined();
  });

  it("sends the bare scope, which the Data API accepts, from an empty URL", () => {
    const scope = taxonomyInteractionsRql("eq(taxon_lineage_ids,561)");
    const rql = scopedStructuralRql(scope, interactionStructuralRql)(parse({}));

    expect(rql).toBe(scope);
    expect(rql).not.toContain("evidence");
    expect(() => validateRql("ppi", rql)).not.toThrow();
  });

  it("filters on experimental alone when that is picked", () => {
    const state = parse({ "interactions.evidence": "experimental" });

    expect(state.filters).toEqual({ evidence: ["experimental"] });
    expect(interactionStructuralRql(state)).toBe("eq(evidence,experimental)");
    expect(() =>
      validateRql("ppi", interactionStructuralRql(state) ?? ""),
    ).not.toThrow();
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

  it("writes a pick as its value and the empty state as no param", () => {
    const written = (filters: CollectionState["filters"]) =>
      replaceChildCollectionSearchParams(
        {},
        "interactions",
        { ...parse({}), filters },
        interactionCollectionOptions,
      ).toString();

    expect(written({})).toBe("");
    expect(written({ evidence: ["experimental"] })).toBe(
      "interactions.evidence=experimental",
    );
    expect(written({ evidence: ["computational"] })).toBe(
      "interactions.evidence=computational",
    );
  });

  it("leaves the other facet picks and the focus as the only terms", () => {
    const state = parse({
      "interactions.interaction_type": "association",
      "interactions.interactor": "fig|1.1",
    });

    expect(interactionStructuralRql(state)).toBe(
      "and(or(eq(interactor_a,fig%7C1.1),eq(interactor_b,fig%7C1.1)),eq(interaction_type,association))",
    );
  });

  it("counts every facet under the state as it stands, with no default to leave out", () => {
    // `facetCountState` has no defaults to drop here, so it hands the state back as it is; the
    // evidence facet is counted without its own filter by the callers, not by this function.
    const urls: Record<string, string>[] = [
      {},
      { "interactions.evidence": "computational" },
      { "interactions.interaction_type": "association" },
    ];
    for (const params of urls) {
      const state = parse(params);
      expect(facetCountState(state, interactionCollectionOptions)).toBe(state);
    }
  });

  it("reads a literal `*` filter value as an ordinary value, in a valid clause", () => {
    // A literal `*` is an ordinary filter value: the rql escapes it (`%2A`), so the clause is
    // valid RQL that names a literal `*` (no row has one) and shows as an Evidence pill the user
    // can clear.
    const state = parse({ "interactions.evidence": "*" });

    expect(state.filters).toEqual({ evidence: ["*"] });
    const clause = interactionStructuralRql(state);
    expect(clause).toBe("eq(evidence,%2A)");
    expect(() => validateRql("ppi", clause ?? "")).not.toThrow();
  });
});
