import { parseTheme, themeList } from "@/styles/themes";

describe("themeList", () => {
  it("offers a light and a dark variant of DXKB, BV-BRC and Violet only", () => {
    expect(themeList).toEqual([
      "dxkb-light",
      "dxkb-dark",
      "bvbrc-light",
      "bvbrc-dark",
      "violet-light",
      "violet-dark",
    ]);
  });
});

describe("parseTheme", () => {
  it("splits a theme into its base and mode", () => {
    expect(parseTheme("bvbrc-dark")).toEqual({ base: "bvbrc", mode: "dark" });
    expect(parseTheme("violet-light")).toEqual({
      base: "violet",
      mode: "light",
    });
  });

  it("reads a retired base as the default base, keeping the mode", () => {
    expect(parseTheme("zinc-dark")).toEqual({ base: "dxkb", mode: "dark" });
    expect(parseTheme("orange-light")).toEqual({
      base: "dxkb",
      mode: "light",
    });
  });

  it("falls back to the default theme for a missing or malformed value", () => {
    expect(parseTheme(undefined)).toEqual({ base: "dxkb", mode: "light" });
    expect(parseTheme("system")).toEqual({ base: "dxkb", mode: "light" });
  });
});
