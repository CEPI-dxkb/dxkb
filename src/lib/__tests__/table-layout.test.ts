import {
  applyBooleanOverrides,
  applyColumnOrder,
  diffBooleanOverrides,
  mergeTableLayout,
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

describe("mergeTableLayout", () => {
  it("applies a patch to nothing stored", () => {
    expect(mergeTableLayout(null, { widths: { a: 120 } })).toBe(
      '{"widths":{"a":120}}',
    );
  });

  it("keeps a field this build does not know when it writes another", () => {
    const stored = '{"density":"compact","order":["b","a"]}';
    const written = mergeTableLayout(stored, { widths: { a: 120 } });
    expect(JSON.parse(written ?? "null")).toStrictEqual({
      density: "compact",
      order: ["b", "a"],
      widths: { a: 120 },
    });
  });

  it("keeps an unknown field verbatim, whatever its value", () => {
    const density = { nested: [1, { deep: null }], flag: true };
    const written = mergeTableLayout(
      JSON.stringify({ density, order: ["b"] }),
      { visibility: { a: false } },
    );
    expect(JSON.parse(written ?? "null")).toStrictEqual({
      density,
      order: ["b"],
      visibility: { a: false },
    });
  });

  it("drops a known field that fails validation but keeps unknown ones", () => {
    const stored = JSON.stringify({
      density: "compact",
      widths: { a: 4100 },
      order: ["b", "a"],
    });
    const written = mergeTableLayout(stored, { facets: { f: true } });
    expect(JSON.parse(written ?? "null")).toStrictEqual({
      density: "compact",
      order: ["b", "a"],
      facets: { f: true },
    });
  });

  it("removes a field the patch sets to undefined", () => {
    const written = mergeTableLayout('{"order":["b","a"],"widths":{"a":120}}', {
      order: undefined,
    });
    expect(JSON.parse(written ?? "null")).toStrictEqual({ widths: { a: 120 } });
  });

  it("keeps an unknown field when the patch clears the last known one", () => {
    const written = mergeTableLayout('{"density":"compact","order":["b","a"]}', {
      order: undefined,
    });
    expect(written).not.toBeNull();
    expect(JSON.parse(written ?? "null")).toStrictEqual({ density: "compact" });
  });

  it("is null when the patch clears everything and nothing unknown is stored", () => {
    expect(mergeTableLayout('{"order":["b","a"]}', { order: undefined })).toBeNull();
    expect(mergeTableLayout(null, { order: undefined })).toBeNull();
    expect(mergeTableLayout(null, {})).toBeNull();
    // A stored field that fails validation counts as absent, so nothing is left.
    expect(
      mergeTableLayout('{"widths":{"a":4100}}', { order: undefined }),
    ).toBeNull();
  });

  it.each(["{nope", "null", "42", '"widths"', "[]", '["order"]', "true"])(
    "replaces a stored value that is not a plain object (%s)",
    (raw) => {
      expect(mergeTableLayout(raw, { widths: { a: 120 } })).toBe(
        '{"widths":{"a":120}}',
      );
    },
  );

  it("removes a stored value that is not a plain object when nothing is patched in", () => {
    expect(mergeTableLayout("[1,2]", { order: undefined })).toBeNull();
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

  it("keeps only the first of a repeated saved id", () => {
    expect(
      applyColumnOrder(["a", "b", "c"], ["c", "a", "c", "a"]),
    ).toStrictEqual(["c", "a", "b"]);
  });

  it("is the default order when nothing is saved", () => {
    expect(applyColumnOrder(["a", "b"], undefined)).toStrictEqual(["a", "b"]);
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
  });
});
