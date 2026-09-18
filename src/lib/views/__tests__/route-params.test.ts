import { readRouteParam, readRouteParamSegments } from "../route-params";

/**
 * Next's own encoding is the oracle: a page component receives
 * `encodeURIComponent(value)` and `generateMetadata` receives `value`, so the
 * helper is correct exactly when both land back on `value`.
 */
const identifiers = [
  ["a slash", "sample/1"],
  ["a space", "Nasal swab"],
  ["a literal percent", "50%"],
  ["a literal %2F", "sample%2F1"],
  ["an ampersand", "a&b"],
  ["a plus", "a+b"],
  ["a hash", "a#b"],
  ["non-ASCII", "Brucélla"],
  ["nothing escaped", "000123"],
] as const;

describe("readRouteParam", () => {
  it.each(identifiers)(
    "round-trips %s through a page component's param",
    (_name, identifier) => {
      expect(readRouteParam(encodeURIComponent(identifier), "page")).toBe(
        identifier,
      );
    },
  );

  it.each(identifiers)(
    "leaves generateMetadata's already-decoded param alone — %s",
    (_name, identifier) => {
      expect(readRouteParam(identifier, "metadata")).toBe(identifier);
    },
  );

  it("does not throw on a malformed escape", () => {
    // Unreachable for a real request, but a route param must never 500.
    expect(readRouteParam("%E0%A4%A", "page")).toBe("%E0%A4%A");
  });

  it("keeps an empty param empty so callers' own validation runs", () => {
    expect(readRouteParam("", "page")).toBe("");
    expect(readRouteParam("", "metadata")).toBe("");
  });
});

describe("readRouteParamSegments", () => {
  it("decodes each catch-all segment independently", () => {
    // `getParamValue` maps `encodeURIComponent` over the array, so a literal
    // slash inside one segment must stay inside that segment.
    const segments = ["alice@bvbrc", "home", "weird/file.pdb"];
    expect(
      readRouteParamSegments(segments.map(encodeURIComponent), "page"),
    ).toEqual(segments);
  });

  it("leaves metadata segments untouched", () => {
    const segments = ["alice@bvbrc", "100%done.pdb"];
    expect(readRouteParamSegments(segments, "metadata")).toEqual(segments);
  });

  it("returns an empty list for an absent optional catch-all", () => {
    expect(readRouteParamSegments([], "page")).toEqual([]);
  });
});
