import {
  applyBooleanOverrides,
  applyColumnOrder,
  diffBooleanOverrides,
  parseTableLayout,
  sameOrder,
} from "../table-layout";

describe("parseTableLayout", () => {
  it("is empty for nothing stored, bad JSON, or a bad shape", () => {
    expect(parseTableLayout(null)).toStrictEqual({});
    expect(parseTableLayout("{nope")).toStrictEqual({});
    expect(parseTableLayout('{"widths":{"a":"wide"}}')).toStrictEqual({});
  });

  it("keeps a valid layout", () => {
    const layout = {
      visibility: { a: false },
      order: ["b", "a"],
      widths: { a: 120 },
      facets: { f: true },
    };
    expect(parseTableLayout(JSON.stringify(layout))).toStrictEqual(layout);
  });

  it("is empty for JSON that is not an object", () => {
    for (const raw of ["null", "42", '"widths"', "[]", "true"]) {
      expect(parseTableLayout(raw)).toStrictEqual({});
    }
  });

  it("drops only a field that fails validation and keeps the others", () => {
    const layout = {
      visibility: { a: false },
      order: ["b", "a"],
      facets: { f: true },
    };
    // Widths outside 20-4000 (or not integers) must not cost the user their
    // column order, hidden columns or facet choices.
    for (const widths of [{ a: 0 }, { a: 4100 }, { a: 12.5 }, { a: "wide" }]) {
      expect(
        parseTableLayout(JSON.stringify({ ...layout, widths })),
      ).toStrictEqual(layout);
    }
  });

  it("keeps a valid widths field when another field is invalid", () => {
    expect(
      parseTableLayout(
        JSON.stringify({ order: "b,a", visibility: { a: 1 }, widths: { a: 120 } }),
      ),
    ).toStrictEqual({ widths: { a: 120 } });
  });
});

describe("boolean overrides", () => {
  const defaults = { a: true, b: false };

  it("applies overrides only for ids that still exist", () => {
    expect(
      applyBooleanOverrides(defaults, { b: true, gone: true }),
    ).toStrictEqual({ a: true, b: true });
  });

  it("stores only differences, and nothing when back at the defaults", () => {
    expect(
      diffBooleanOverrides(defaults, { a: false, b: false }),
    ).toStrictEqual({
      a: false,
    });
    expect(
      diffBooleanOverrides(defaults, { a: true, b: false }),
    ).toBeUndefined();
  });
});

describe("applyColumnOrder", () => {
  it("keeps the saved order, drops stale ids, and appends new columns", () => {
    expect(
      applyColumnOrder(["a", "b", "c", "d"], ["c", "gone", "a"]),
    ).toStrictEqual(["c", "a", "b", "d"]);
  });

  it("is the default order when nothing is saved", () => {
    expect(applyColumnOrder(["a", "b"], undefined)).toStrictEqual(["a", "b"]);
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
  });
});
