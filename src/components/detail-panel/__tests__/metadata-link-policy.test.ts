import {
  classifyHref,
  isLinkValue,
  resolveLink,
} from "../metadata-link-policy";

describe("resolveLink", () => {
  it("resolves a row-aware placeholder directly from a matching row field", () => {
    expect(
      resolveLink(
        "/genome/{genome_id}",
        { genome_id: "83332.12", genome_name: "M. tuberculosis H37Rv" },
        "genome_name",
      ),
    ).toBe("/genome/83332.12");
  });

  it("falls back to the field's own value for the {value} sentinel", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "83332.12" }, "genome_id"),
    ).toBe("/genome/83332.12");
  });

  it("URL-encodes the resolved segment", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "100/2" }, "genome_id"),
    ).toBe("/genome/100%2F2");
  });

  it("preserves falsy-but-real primitives such as 0", () => {
    expect(resolveLink("/thing/{value}", { count: 0 }, "count")).toBe(
      "/thing/0",
    );
  });

  it("rejects the link when a row-aware placeholder has no matching field anywhere", () => {
    expect(
      resolveLink(
        "/genome/{genome_id}",
        { unrelated: "x" },
        "unrelated_fallback",
      ),
    ).toBeUndefined();
  });

  it("rejects the link when the resolved value is an empty string", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "" }, "genome_id"),
    ).toBeUndefined();
  });

  it("rejects the link when the value is a non-primitive (array/object)", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: ["a", "b"] }, "genome_id"),
    ).toBeUndefined();
  });

  it("never leaves a literal unresolved {placeholder} in the output", () => {
    const result = resolveLink("/genome/{missing}", {}, "also_missing");
    expect(result === undefined || !result.includes("{")).toBe(true);
  });
});

describe("classifyHref", () => {
  it("classifies a same-origin relative path as internal", () => {
    expect(classifyHref("/genome/123")).toBe("internal");
  });

  it("classifies an absolute http(s) URL as external", () => {
    expect(classifyHref("https://www.ncbi.nlm.nih.gov/taxonomy/1")).toBe(
      "external",
    );
    expect(classifyHref("http://example.com")).toBe("external");
  });

  it("classifies a protocol-relative //host as unsafe, not internal", () => {
    // A browser resolves "//evil.com" as an absolute, cross-origin URL despite
    // the missing scheme — a bare startsWith("/") check would wrongly treat it
    // as same-origin and hand it straight to Link.
    expect(classifyHref("//evil.com")).toBe("unsafe");
  });

  it("classifies a javascript: URI as unsafe, never internal", () => {
    expect(classifyHref("javascript:alert(1)")).toBe("unsafe");
  });

  it("classifies a bare mailto: URI as unsafe", () => {
    expect(classifyHref("mailto:someone@example.com")).toBe("unsafe");
  });

  it("classifies a scheme-less, non-rooted string as unsafe", () => {
    expect(classifyHref("genome/123")).toBe("unsafe");
    expect(classifyHref("")).toBe("unsafe");
  });
});

describe("isLinkValue", () => {
  it("accepts the primitives that can be substituted into a template", () => {
    expect(isLinkValue("83332.12")).toBe(true);
    expect(isLinkValue(0)).toBe(true);
    expect(isLinkValue(false)).toBe(true);
  });

  it("rejects values that have no single template segment", () => {
    expect(isLinkValue(null)).toBe(false);
    expect(isLinkValue(undefined)).toBe(false);
    expect(isLinkValue(["a", "b"])).toBe(false);
    expect(isLinkValue({ genome_id: "1" })).toBe(false);
  });
});

describe("the relocated boundary's fail-closed contract", () => {
  // The classifier and the resolver moved out of `info-panel.tsx` into this
  // module. What must survive the move is that a row value cannot widen the
  // classification: `resolveLink` percent-encodes every row-supplied segment,
  // so a row carrying a scheme or a protocol-relative prefix still resolves to
  // an internal path, and a template that is itself unsafe still classifies as
  // unsafe.
  it("keeps a scheme-bearing row value inside the internal path segment", () => {
    const href = resolveLink(
      "/genome/{value}",
      { genome_id: "javascript:alert(1)" },
      "genome_id",
    );
    expect(href).toBe("/genome/javascript%3Aalert(1)");
    expect(classifyHref(href ?? "")).toBe("internal");
  });

  it("keeps a protocol-relative row value from escaping to //host", () => {
    const href = resolveLink(
      "/genome/{value}",
      { genome_id: "//evil.com" },
      "genome_id",
    );
    expect(href).toBe("/genome/%2F%2Fevil.com");
    expect(classifyHref(href ?? "")).toBe("internal");
  });

  it("still classifies an unsafe template as unsafe after resolution", () => {
    const href = resolveLink(
      "javascript:alert({value})",
      { payload: "1" },
      "payload",
    );
    expect(href).toBe("javascript:alert(1)");
    expect(classifyHref(href ?? "")).toBe("unsafe");
  });
});
