import {
  encodePathSegment,
  encodeQueryComponent,
  safeDecode,
  toQueryString,
} from "@/lib/url";

describe("safeDecode", () => {
  it("decodes valid percent-encoded strings", () => {
    expect(safeDecode("hello%20world")).toBe("hello world");
    expect(safeDecode("%2Fpath%2Fto%2Ffile")).toBe("/path/to/file");
  });

  it("decodes encoded special characters", () => {
    expect(safeDecode("foo%40bar")).toBe("foo@bar");
    expect(safeDecode("100%25")).toBe("100%");
  });

  it("returns original string for malformed sequences", () => {
    expect(safeDecode("%E0%A4%A")).toBe("%E0%A4%A");
    expect(safeDecode("%ZZ")).toBe("%ZZ");
  });

  it("handles empty string", () => {
    expect(safeDecode("")).toBe("");
  });

  it("returns already-decoded strings as-is", () => {
    expect(safeDecode("hello world")).toBe("hello world");
    expect(safeDecode("no-encoding-here")).toBe("no-encoding-here");
  });
});

describe("encodeQueryComponent", () => {
  it.each([
    ["RQL", "eq(public,false)", "eq(public,false)"],
    ["a path with an email", "/workspace/a@b.org/x", "/workspace/a@b.org/x"],
    ["colon, semicolon, dollar, question mark", "a:b;c$d?e", "a:b;c$d?e"],
    ["a space", "E coli", "E+coli"],
    ["query syntax", "a&b=c+d#e%f", "a%26b%3Dc%2Bd%23e%25f"],
    ["quotes", `"x" 'y'`, "%22x%22+%27y%27"],
    ["an existing escape", "a%2Cb", "a%252Cb"],
    ["non-ASCII", "é", "%C3%A9"],
  ])("encodes %s", (_name, value, expected) => {
    expect(encodeQueryComponent(value)).toBe(expected);
  });

  it.each(["eq(public,false)", "a&b=c+d#e%f", `"x" 'y'`, "a%2Cb", "é", "E coli"])(
    "round-trips %s through URLSearchParams",
    (value) => {
      expect(
        new URLSearchParams(`k=${encodeQueryComponent(value)}`).get("k"),
      ).toBe(value);
    },
  );

  it("replaces a lone surrogate like URLSearchParams instead of throwing", () => {
    expect(encodeQueryComponent("a\uD800b")).toBe("a%EF%BF%BDb");
    expect(new URLSearchParams([["k", "a\uD800b"]]).toString()).toBe(
      "k=a%EF%BF%BDb",
    );
  });
});

describe("encodePathSegment", () => {
  it.each([
    ["an email", "user@bvbrc", "user@bvbrc"],
    ["sub-delims", "a,b(c)&d=e+f;g$h:i", "a,b(c)&d=e+f;g$h:i"],
    ["a slash", "a/b", "a%2Fb"],
    ["a space", "My Folder", "My%20Folder"],
    ["a pipe", "fig|83332.12.peg.1", "fig%7C83332.12.peg.1"],
    ["query and fragment markers", "a?b#c", "a%3Fb%23c"],
    ["a percent", "100%", "100%25"],
  ])("encodes %s", (_name, value, expected) => {
    expect(encodePathSegment(value)).toBe(expected);
  });

  it.each(["a,b(c)&d=e+f", "a/b", "My Folder", "fig|1", "100%"])(
    "round-trips %s through decodeURIComponent",
    (value) => {
      expect(decodeURIComponent(encodePathSegment(value))).toBe(value);
    },
  );

  it("replaces a lone surrogate instead of throwing", () => {
    expect(encodePathSegment("\uDC00x")).toBe("%EF%BF%BDx");
  });
});

describe("toQueryString", () => {
  it("joins readable pairs in order, keeping repeated names", () => {
    const params = new URLSearchParams();
    params.append("rql", "eq(genus,Escherichia)");
    params.append("keyword", "E coli");
    params.append("keep", "a");
    params.append("keep", "b");
    expect(toQueryString(params)).toBe(
      "rql=eq(genus,Escherichia)&keyword=E+coli&keep=a&keep=b",
    );
  });

  it("returns an empty string for no params", () => {
    expect(toQueryString(new URLSearchParams())).toBe("");
  });

  it("parses back to the same params", () => {
    const params = new URLSearchParams([["redirect", "/genome?rql=eq(a,b)&x=1"]]);
    expect(new URLSearchParams(toQueryString(params)).get("redirect")).toBe(
      "/genome?rql=eq(a,b)&x=1",
    );
  });
});
