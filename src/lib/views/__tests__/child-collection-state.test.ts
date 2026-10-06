import {
  childCollectionOptions,
  childCollectionUrlKeys,
  deleteChildCollectionParams,
  isChildCollectionParam,
  parseChildCollectionState,
  replaceChildCollectionSearchParams,
  withoutChildCollectionParams,
} from "../child-collection-state";

const options = childCollectionOptions(
  [{ id: "start" }, { id: "product" }, { id: "internal", sortable: false }],
  [{ field: "feature_type" }],
  "start:asc",
);

describe("child collection URL state", () => {
  it("reads only its own prefixed params", () => {
    expect(
      parseChildCollectionState(
        {
          tab: "features",
          page: "9",
          "features.page": "2",
          "features.sort": "product:desc",
          "features.feature_type": "CDS",
          "domains.page": "5",
        },
        "features",
        options,
      ),
    ).toStrictEqual({
      keyword: undefined,
      refine: undefined,
      rql: undefined,
      filters: { feature_type: ["CDS"] },
      page: 2,
      sort: "product:desc",
    });
  });

  it("never takes structural RQL or an unsortable column from the URL", () => {
    const state = parseChildCollectionState(
      { "features.rql": "ne(x,1)", "features.sort": "internal:asc" },
      "features",
      options,
    );
    expect(state.rql).toBeUndefined();
    expect(state.sort).toBe("start:asc");
  });

  it("keeps its filters when the URL also carries a stray rql or refine", () => {
    // An explicit rql makes parseCollectionState skip friendly filters, so the
    // stray param has to be gone before parsing, not just from the result.
    expect(
      parseChildCollectionState(
        {
          "features.rql": "x",
          "features.refine": "kinase",
          "features.feature_type": "CDS",
        },
        "features",
        options,
      ),
    ).toStrictEqual({
      keyword: undefined,
      refine: undefined,
      rql: undefined,
      filters: { feature_type: ["CDS"] },
      page: 1,
      sort: "start:asc",
    });
  });

  it("never takes a refine term from the URL", () => {
    expect(
      parseChildCollectionState(
        { "features.refine": "kinase" },
        "features",
        options,
      ).refine,
    ).toBeUndefined();
  });

  it("replaces only its own params and omits defaults", () => {
    const params = replaceChildCollectionSearchParams(
      {
        tab: "features",
        rql: "eq(a,1)",
        "features.page": "4",
        "domains.page": "5",
      },
      "features",
      { filters: {}, page: 2, sort: "start:asc" },
      options,
    );
    expect(params.toString()).toBe(
      "tab=features&rql=eq%28a%2C1%29&domains.page=5&features.page=2",
    );
  });

  it("does not write structural RQL or a refine term for a child", () => {
    const params = replaceChildCollectionSearchParams(
      {},
      "features",
      {
        filters: {},
        page: 1,
        sort: "start:asc",
        rql: "ne(x,1)",
        refine: "kinase",
        keyword: "dnaK",
      },
      options,
    );
    expect(params.toString()).toBe("features.keyword=dnaK");
  });

  it("recognizes and strips child params", () => {
    expect(isChildCollectionParam("features.page")).toBe(true);
    expect(isChildCollectionParam("page")).toBe(false);
    expect(
      withoutChildCollectionParams({ tab: "x", "features.page": "2" }),
    ).toStrictEqual({ tab: "x" });
  });

  it("deletes every child param from a URLSearchParams in place", () => {
    const params = new URLSearchParams(
      "tab=x&features.page=2&features.feature_type=CDS&features.feature_type=rRNA&domains.sort=a:desc&keep=1&keep=2",
    );
    deleteChildCollectionParams(params);
    expect(params.toString()).toBe("tab=x&keep=1&keep=2");
  });

  it("leaves a dotted param that no nested table owns", () => {
    expect(isChildCollectionParam("source.id")).toBe(false);
    expect(isChildCollectionParam(".page")).toBe(false);
    expect(isChildCollectionParam("features")).toBe(false);
    expect(
      withoutChildCollectionParams({ "source.id": "123", "features.page": "2" }),
    ).toStrictEqual({ "source.id": "123" });
    const params = new URLSearchParams("source.id=123&domains.page=2");
    deleteChildCollectionParams(params);
    expect(params.toString()).toBe("source.id=123");
  });

  it("recognizes every registered urlKey", () => {
    for (const urlKey of childCollectionUrlKeys) {
      expect(isChildCollectionParam(`${urlKey}.page`)).toBe(true);
    }
  });

  it("allows unsorted only alongside the sortable columns", () => {
    expect(options.sortAllowlist).toStrictEqual([
      "start:asc",
      "unsorted",
      "start:desc",
      "product:asc",
      "product:desc",
    ]);
    expect(options.friendlyFilters).toStrictEqual(["feature_type"]);
  });
});

describe("child collection default filters", () => {
  const withDefault = childCollectionOptions(
    [{ id: "start" }],
    [{ field: "annotation" }, { field: "feature_type" }],
    "unsorted",
    { annotation: ["PATRIC"] },
  );

  it("selects the default until its own prefixed param clears it", () => {
    expect(
      parseChildCollectionState({ tab: "features" }, "features", withDefault)
        .filters,
    ).toEqual({ annotation: ["PATRIC"] });
    expect(
      parseChildCollectionState(
        { "features.annotation": "*" },
        "features",
        withDefault,
      ).filters,
    ).toEqual({});
  });

  it("writes only a removed default, under its prefix", () => {
    expect(
      replaceChildCollectionSearchParams(
        { tab: "features" },
        "features",
        { filters: {}, page: 1, sort: "unsorted" },
        withDefault,
      ).toString(),
    ).toBe("tab=features&features.annotation=*");
    expect(
      replaceChildCollectionSearchParams(
        { tab: "features", "features.annotation": "*" },
        "features",
        { filters: { annotation: ["PATRIC"] }, page: 1, sort: "unsorted" },
        withDefault,
      ).toString(),
    ).toBe("tab=features");
  });
});
