import {
  canonicalizeCollectionSearchParams,
  canonicalizeCollectionState,
  collectionManagedParamNames,
  parseCollectionState,
  replaceCollectionSearchParams,
  serializeCollectionState,
  toSearchParamsRecord,
  unionCollectionManagedParamNames,
  updateCollectionSearchParams,
  type CollectionStateOptions,
} from "../collection-state";

const options = {
  defaultSort: "relevance",
  sortAllowlist: ["relevance", "name", "date"] as const,
  friendlyFilters: ["taxon_id", "host"] as const,
} satisfies CollectionStateOptions<"relevance" | "name" | "date">;

describe("collection URL state", () => {
  it("parses one-based paging and canonical defaults", () => {
    expect(parseCollectionState({}, options)).toEqual({
      keyword: undefined,
      rql: undefined,
      filters: {},
      page: 1,
      sort: "relevance",
    });
    expect(
      parseCollectionState({ page: "3", sort: "name" }, options),
    ).toMatchObject({
      page: 3,
      sort: "name",
    });
  });

  it.each(["0", "-1", "1.5", "01", "abc", "9007199254740992"])(
    "canonicalizes invalid page %s to page 1",
    (page) => {
      expect(parseCollectionState({ page }, options).page).toBe(1);
    },
  );

  it("canonicalizes repeated pages and invalid sorts to defaults", () => {
    expect(parseCollectionState({ page: ["1", "2"] }, options).page).toBe(1);
    expect(parseCollectionState({ sort: "score desc" }, options).sort).toBe(
      "relevance",
    );
    expect(
      canonicalizeCollectionSearchParams(
        { page: ["1", "2"], sort: "score desc", keep: "yes" },
        options,
      ).toString(),
    ).toBe("keep=yes");
  });

  it("keeps keyword independent and gives explicit rql precedence over friendly filters", () => {
    // What the composer then does with this state is
    // `structuralFilterRql`'s contract, asserted in structural-rql.test.ts.
    const state = parseCollectionState(
      { keyword: "influenza", rql: "eq(public,true)", taxon_id: "11520" },
      options,
    );
    expect(state.keyword).toBe("influenza");
    expect(state.rql).toBe("eq(public,true)");
    expect(state.filters).toEqual({});
  });

  it("preserves explicitly independent filters alongside rql", () => {
    const independentOptions = {
      ...options,
      friendlyFilters: [...options.friendlyFilters, "filter"],
      independentFilters: ["filter"],
    } satisfies CollectionStateOptions;
    const state = parseCollectionState(
      { rql: "eq(public,true)", taxon_id: "2", filter: "protein" },
      independentOptions,
    );
    expect(state.filters).toEqual({ filter: ["protein"] });
    expect(serializeCollectionState(state, independentOptions).toString()).toBe(
      "rql=eq%28public%2Ctrue%29&filter=protein",
    );
  });

  it("canonicalizes an opted-in legacy RQL filter", () => {
    const legacyOptions = {
      ...options,
      legacyRqlFilter: true,
    } satisfies CollectionStateOptions;
    const state = parseCollectionState(
      { filter: "eq(public,true)" },
      legacyOptions,
    );

    expect(state.rql).toBe("eq(public,true)");
    expect(
      parseCollectionState(
        { rql: "eq(public,false)", filter: "eq(public,true)" },
        legacyOptions,
      ).rql,
    ).toBe("eq(public,false)");
    expect(
      canonicalizeCollectionSearchParams(
        { filter: "eq(public,true)" },
        legacyOptions,
      ).toString(),
    ).toBe("rql=eq%28public%2Ctrue%29");
  });

  it("preserves an opted-in filter that is not consumed as legacy RQL", () => {
    const legacyOptions = {
      ...options,
      legacyRqlFilter: true,
    } satisfies CollectionStateOptions;

    expect(
      canonicalizeCollectionSearchParams(
        { filter: "protein", tab: "details" },
        legacyOptions,
      ).toString(),
    ).toBe("filter=protein&tab=details");
    expect(
      canonicalizeCollectionSearchParams(
        { rql: "eq(public,false)", filter: "eq(public,true)" },
        legacyOptions,
      ).toString(),
    ).toBe("filter=eq%28public%2Ctrue%29&rql=eq%28public%2Cfalse%29");
  });

  it("collects multi-value friendly fields and serializes each value separately", () => {
    const state = parseCollectionState(
      { keyword: "coli", taxon_id: "2", host: ["human", "swine"] },
      options,
    );
    expect(state.filters).toEqual({ taxon_id: ["2"], host: ["human", "swine"] });
    expect(serializeCollectionState(state, options).getAll("host")).toEqual([
      "human",
      "swine",
    ]);
  });

  it("deduplicates and serializes repeated facet values", () => {
    const state = parseCollectionState(
      { host: ["human", "swine", "human"] },
      options,
    );
    expect(state.filters).toEqual({ host: ["human", "swine"] });
    expect(serializeCollectionState(state, options).getAll("host")).toEqual([
      "human",
      "swine",
    ]);
  });

  it("serializes a refinement independently from the primary keyword", () => {
    const state = parseCollectionState(
      { keyword: "influenza", refine: "N034" },
      options,
    );

    expect(state).toMatchObject({ keyword: "influenza", refine: "N034" });
    expect(serializeCollectionState(state, options).toString()).toBe(
      "keyword=influenza&refine=N034",
    );
  });

  it("omits page 1 and the default sort without exposing a tie-break", () => {
    const serialized = serializeCollectionState(
      {
        keyword: "flu",
        filters: { taxon_id: ["2"] },
        page: 1,
        sort: "relevance",
      },
      options,
    );
    expect(serialized.toString()).toBe("keyword=flu&taxon_id=2");
    expect(serialized.has("page")).toBe(false);
    expect(serialized.has("sort")).toBe(false);
    expect(serialized.toString()).not.toMatch(/tie|secondary/i);
  });

  it("canonicalizes URL values while preserving unrelated repeated parameters", () => {
    const canonical = canonicalizeCollectionSearchParams(
      { page: "1", sort: "relevance", tab: "genomes", keep: ["a", "b"] },
      options,
    );
    expect(canonical.toString()).toBe("tab=genomes&keep=a&keep=b");
  });

  it("drops friendly filters from the canonical URL when rql is explicit", () => {
    const canonical = canonicalizeCollectionSearchParams(
      { rql: "eq(public,true)", taxon_id: "2", keyword: "flu" },
      options,
    );
    expect(canonical.toString()).toBe("keyword=flu&rql=eq%28public%2Ctrue%29");
  });

  it.each([
    ["keyword", { keyword: "new" }],
    ["refinement", { refine: "N034" }],
    ["structural RQL", { rql: "eq(public,true)" }],
    ["facet", { filters: { host: ["human"] } }],
    ["sort", { sort: "date" as const }],
  ])("resets page when %s changes", (_label, update) => {
    const next = updateCollectionSearchParams(
      { page: "4", tab: "genomes" },
      update,
      options,
    );
    expect(next.has("page")).toBe(false);
    expect(next.get("tab")).toBe("genomes");
  });

  it("retains page for an unrelated update or an unchanged query value", () => {
    expect(
      updateCollectionSearchParams({ page: "4" }, {}, options).get("page"),
    ).toBe("4");
    expect(
      updateCollectionSearchParams(
        { page: "4", keyword: "flu" },
        { keyword: "flu" },
        options,
      ).get("page"),
    ).toBe("4");
  });

  it("rejects invalid programmatic state", () => {
    expect(() =>
      canonicalizeCollectionState(
        { filters: {}, page: 0, sort: "relevance" },
        options,
      ),
    ).toThrow("Invalid collection page");
  });
});

describe("replaceCollectionSearchParams", () => {
  it("preserves the caller-supplied page even when the query shape changes", () => {
    // Unlike updateCollectionSearchParams, a full-state replacement must not
    // reset pagination — the caller already owns the complete next state.
    const merged = replaceCollectionSearchParams(
      { page: "9", tab: "genomes" },
      { keyword: "flu", filters: {}, page: 5, sort: "relevance" },
      options,
    );
    expect(merged.get("page")).toBe("5");
    expect(merged.get("keyword")).toBe("flu");
    expect(merged.get("tab")).toBe("genomes");
  });

  it("preserves repeated unrelated parameters", () => {
    const merged = replaceCollectionSearchParams(
      { page: "1", sort: "relevance", tab: "genomes", keep: ["a", "b"] },
      { filters: {}, page: 1, sort: "relevance" },
      options,
    );
    expect(merged.toString()).toBe("tab=genomes&keep=a&keep=b");
  });

  it("clears a consumed legacy filter on replacement", () => {
    const legacyOptions = {
      ...options,
      legacyRqlFilter: true,
    } satisfies CollectionStateOptions;
    const merged = replaceCollectionSearchParams(
      { filter: "eq(public,true)", tab: "details" },
      { rql: "eq(public,false)", filters: {}, page: 1, sort: "relevance" },
      legacyOptions,
    );
    expect(merged.has("filter")).toBe(false);
    expect(merged.get("rql")).toBe("eq(public,false)");
    expect(merged.get("tab")).toBe("details");
  });

  it("preserves an unconsumed legacy filter on replacement", () => {
    const legacyOptions = {
      ...options,
      legacyRqlFilter: true,
    } satisfies CollectionStateOptions;
    const merged = replaceCollectionSearchParams(
      { filter: "protein", tab: "details" },
      { filters: {}, page: 2, sort: "relevance" },
      legacyOptions,
    );
    expect(merged.get("filter")).toBe("protein");
    expect(merged.get("page")).toBe("2");
    expect(merged.get("tab")).toBe("details");
  });
});

describe("collectionManagedParamNames", () => {
  it("returns the fixed managed keys plus this view's friendly filters", () => {
    expect([...collectionManagedParamNames({}, options)].sort()).toEqual(
      ["keyword", "refine", "rql", "page", "sort", "taxon_id", "host"].sort(),
    );
  });

  it("includes filter only while it is being consumed as legacy RQL", () => {
    const legacyOptions = {
      ...options,
      legacyRqlFilter: true,
    } satisfies CollectionStateOptions;
    expect(
      collectionManagedParamNames(
        { filter: "eq(public,true)" },
        legacyOptions,
      ).has("filter"),
    ).toBe(true);
    expect(
      collectionManagedParamNames({ filter: "protein" }, legacyOptions).has(
        "filter",
      ),
    ).toBe(false);
  });
});

describe("unionCollectionManagedParamNames", () => {
  const strainLikeOptions = {
    defaultSort: "unsorted",
    sortAllowlist: ["unsorted"] as const,
    friendlyFilters: ["strain_status"],
  } satisfies CollectionStateOptions<"unsorted">;

  const surveillanceLikeOptions = {
    defaultSort: "unsorted",
    sortAllowlist: ["unsorted"] as const,
    friendlyFilters: ["pathogen_test_result"],
  } satisfies CollectionStateOptions<"unsorted">;

  const legacyLikeOptions = {
    defaultSort: "unsorted",
    sortAllowlist: ["unsorted"] as const,
    friendlyFilters: ["feature_id"],
    legacyRqlFilter: true,
  } satisfies CollectionStateOptions<"unsorted">;

  it("unions friendly filters from every participating view with the fixed managed keys, including refine", () => {
    const union = unionCollectionManagedParamNames({}, [
      options,
      strainLikeOptions,
      surveillanceLikeOptions,
    ]);
    expect([...union].sort()).toEqual(
      [
        "keyword",
        "refine",
        "rql",
        "page",
        "sort",
        "taxon_id",
        "host",
        "strain_status",
        "pathogen_test_result",
      ].sort(),
    );
  });

  it("includes the legacy filter key only for a view currently consuming it", () => {
    const consumed = unionCollectionManagedParamNames(
      { filter: "eq(public,true)" },
      [options, legacyLikeOptions],
    );
    expect(consumed.has("filter")).toBe(true);

    const unconsumed = unionCollectionManagedParamNames(
      { filter: "protein" },
      [options, legacyLikeOptions],
    );
    expect(unconsumed.has("filter")).toBe(false);
  });

  it("leaves genuinely unrelated parameter names out of the union", () => {
    const union = unionCollectionManagedParamNames({}, [
      options,
      strainLikeOptions,
    ]);
    expect(union.has("tab")).toBe(false);
    expect(union.has("view")).toBe(false);
    expect(union.has("utm_source")).toBe(false);
  });

  it("clears every participating view's stray state on a cross-tab transition while preserving unrelated params", () => {
    // Mirrors what the organism landing shell does on a tab switch: compute
    // the union across every tab's options, then delete those names from the
    // current URL — regardless of which tab actually owns each value.
    const params = new URLSearchParams(
      "taxon_id=123&strain_status=active&pathogen_test_result=positive&refine=N034&tab=strains&utm_source=email",
    );
    const union = unionCollectionManagedParamNames(
      toSearchParamsRecord(params),
      [options, strainLikeOptions, surveillanceLikeOptions],
    );
    for (const name of union) params.delete(name);
    expect(params.toString()).toBe("tab=strains&utm_source=email");
  });
});
