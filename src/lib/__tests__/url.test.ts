import { safeDecode } from "@/lib/url";

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
