import {
  cn,
  downloadBlob,
  formatUserFacingErrorMessage,
  getFirstDefined,
  maxUserFacingErrorMessageLength,
  noop,
} from "@/lib/utils";

describe("cn", () => {
  it("combines multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    const condition = false as boolean;
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
    // noop's declared return type is void; calling it as a standalone statement
    // verifies it executes without throwing. The void return type is checked by TS.
    noop();
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

describe("formatUserFacingErrorMessage", () => {
  it("keeps a real message intact", () => {
    expect(
      formatUserFacingErrorMessage(
        new Error("Upstream failure: connection reset by peer"),
        "fallback",
      ),
    ).toBe("Upstream failure: connection reset by peer");
  });

  it("falls back for a non-Error rejection", () => {
    // `String(error)` put "[object Object]" in front of the user instead.
    expect(formatUserFacingErrorMessage({ status: 502 }, "fallback")).toBe(
      "fallback",
    );
    expect(formatUserFacingErrorMessage("socket reset", "fallback")).toBe(
      "fallback",
    );
    expect(formatUserFacingErrorMessage(undefined, "fallback")).toBe(
      "fallback",
    );
  });

  it("falls back for an empty or whitespace-only Error message", () => {
    // An empty string is falsy, so it can suppress a `{message && …}` render
    // guard outright — and where the guard tests the error object instead, it
    // paints an alert with no text in it.
    expect(formatUserFacingErrorMessage(new Error(), "fallback")).toBe(
      "fallback",
    );
    expect(formatUserFacingErrorMessage(new Error("   \n"), "fallback")).toBe(
      "fallback",
    );
  });

  it("trims surrounding whitespace off a real message", () => {
    expect(
      formatUserFacingErrorMessage(new Error("  upstream reset  "), "fallback"),
    ).toBe("upstream reset");
  });

  it("leaves a message exactly at the presentation limit untouched", () => {
    const boundary = "x".repeat(maxUserFacingErrorMessageLength);
    expect(formatUserFacingErrorMessage(new Error(boundary), "fallback")).toBe(
      boundary,
    );
  });

  it("truncates past the presentation limit instead of replacing the message", () => {
    const long = `Upstream failure: ${"x".repeat(400)}`;
    const formatted = formatUserFacingErrorMessage(
      new Error(long),
      "fallback",
    );
    expect(formatted).toBe(`${long.slice(0, maxUserFacingErrorMessageLength)}…`);
    expect(formatted).toContain("Upstream failure:");
  });
});

describe("downloadBlob", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clicks a detached download anchor for the blob and releases its URL afterwards", () => {
    vi.useFakeTimers();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fasta");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clicked: { href: string; download: string; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push({
          href: this.href,
          download: this.download,
          attached: this.isConnected,
        });
      },
    );
    const blob = new Blob([">a\nACGT\n"]);

    downloadBlob(blob, "fig_1.1.peg.1.dna.fasta");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([
      {
        href: "blob:fasta",
        download: "fig_1.1.peg.1.dna.fasta",
        attached: true,
      },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
    // Not synchronously: WebKit may still be reading the URL.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fasta");
  });
});
