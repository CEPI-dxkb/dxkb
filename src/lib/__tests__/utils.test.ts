import {
  cn,
  noop,
  sanitizePathSegment,
  encodeWorkspaceSegment,
  getFirstDefined,
} from "@/lib/utils";

describe("cn", () => {
  it("combines multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    const condition = false;
    expect(cn("base", condition && "hidden", "extra")).toBe("base extra");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("noop", () => {
  it("is a function", () => {
    expect(typeof noop).toBe("function");
  });

  it("returns undefined", () => {
    expect(noop()).toBeUndefined();
  });
});

describe("sanitizePathSegment", () => {
  it("trims whitespace", () => {
    expect(sanitizePathSegment("  hello  ")).toBe("hello");
  });

  it("removes null bytes", () => {
    expect(sanitizePathSegment("foo\0bar")).toBe("foobar");
  });

  it("removes control characters", () => {
    expect(sanitizePathSegment("foo\x01\x1Fbar")).toBe("foobar");
  });

  it("removes DEL character (\\u007F)", () => {
    expect(sanitizePathSegment("foo\x7Fbar")).toBe("foobar");
  });

  it("returns empty string for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizePathSegment(123 as any)).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizePathSegment(null as any)).toBe("");
  });

  it("passes through normal strings unchanged", () => {
    expect(sanitizePathSegment("my-file.txt")).toBe("my-file.txt");
  });
});

describe("encodeWorkspaceSegment", () => {
  it("encodes special characters", () => {
    expect(encodeWorkspaceSegment("hello world")).toBe("hello%20world");
  });

  it("preserves @ symbol", () => {
    expect(encodeWorkspaceSegment("user@host")).toBe("user@host");
  });

  it("sanitizes input before encoding", () => {
    expect(encodeWorkspaceSegment("  foo\0bar  ")).toBe("foobar");
  });

  it("encodes slashes", () => {
    expect(encodeWorkspaceSegment("a/b")).toBe("a%2Fb");
  });
});

describe("getFirstDefined", () => {
  it("returns the first non-null/undefined value", () => {
    const obj = { a: undefined, b: null, c: "found" };
    expect(getFirstDefined(obj, "a", "b", "c")).toBe("found");
  });

  it("returns undefined when no match exists", () => {
    const obj = { a: undefined, b: null };
    expect(getFirstDefined(obj, "a", "b", "missing")).toBeUndefined();
  });

  it("skips null values", () => {
    const obj = { a: null, b: 42 };
    expect(getFirstDefined(obj, "a", "b")).toBe(42);
  });

  it("skips undefined values", () => {
    const obj = { a: undefined, b: "yes" };
    expect(getFirstDefined(obj, "a", "b")).toBe("yes");
  });

  it("returns the first key if it has a value", () => {
    const obj = { a: "first", b: "second" };
    expect(getFirstDefined(obj, "a", "b")).toBe("first");
  });

  it("returns 0 and false as valid values", () => {
    const obj = { a: 0, b: false };
    expect(getFirstDefined(obj, "a")).toBe(0);
    expect(getFirstDefined(obj, "b")).toBe(false);
  });
});
