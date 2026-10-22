import { buildJBrowseTheme, rgbToHex, trackColorsFrom, type ThemeColors } from "../theme";

const colors: ThemeColors = {
  primary: "#1f3a8a",
  secondary: "#f08a3c",
  link: "#8fb4ff",
  background: "#ffffff",
  card: "#fafafa",
  foreground: "#111111",
  chart1: "#e07b39",
  chart2: "#3b82f6",
};

describe("genome browser theme", () => {
  it("formats canvas pixels as hex", () => {
    expect(rgbToHex(23, 72, 125)).toBe("#17487d");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("maps light theme tokens onto JBrowse's palette", () => {
    expect(buildJBrowseTheme(colors, "light", "Inter")).toEqual({
      palette: {
        mode: "light",
        primary: { main: "#1f3a8a" },
        secondary: { main: "#f08a3c" },
        tertiary: { main: "#1f3a8a" },
        quaternary: { main: "#f08a3c" },
        background: { default: "#ffffff", paper: "#fafafa" },
        text: { primary: "#111111" },
      },
      typography: { fontFamily: "Inter" },
    });
  });

  it("uses the link token as primary in dark themes", () => {
    const theme = buildJBrowseTheme(colors, "dark", "Inter");
    expect(theme.palette.primary).toEqual({ main: "#8fb4ff" });
    expect(theme.palette.mode).toBe("dark");
  });

  it("colors the two annotation tracks with the first two chart tokens", () => {
    expect(trackColorsFrom(colors)).toEqual({ PATRIC: "#e07b39", RefSeq: "#3b82f6" });
  });
});
