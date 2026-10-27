import type { GenomeBrowserAnnotation } from "@/lib/genome-browser/contract";
import type { ThemeMode } from "@/styles/themes";

/**
 * The theme tokens the browser takes its colors from, as hex. The tokens are
 * oklch, which MUI (JBrowse's UI library) cannot parse, so they are resolved
 * through a canvas pixel.
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  link: string;
  background: string;
  card: string;
  foreground: string;
  chart1: string;
  chart2: string;
}

export type GenomeBrowserTrackColors = Record<GenomeBrowserAnnotation, string>;

export interface JBrowseTheme {
  palette: Record<string, unknown>;
  typography: { fontFamily: string };
}

const tokenNames: Record<keyof ThemeColors, string> = {
  primary: "--primary",
  secondary: "--secondary",
  link: "--link",
  background: "--background",
  card: "--card",
  foreground: "--foreground",
  chart1: "--chart-1",
  chart2: "--chart-2",
};

/** Legacy BV-BRC's PATRIC blue and JBrowse's own defaults, for a token that does not resolve. */
const fallbackColors: ThemeColors = {
  primary: "#17487d",
  secondary: "#357089",
  link: "#17487d",
  background: "#ffffff",
  card: "#ffffff",
  foreground: "#0a0a0a",
  chart1: "#17487d",
  chart2: "#357089",
};

/** A fill no theme token uses, to tell "invalid color" from black. */
const sentinelColor = "#010203";

export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const resolve = (value: string): string | undefined => {
    if (!context || value === "") return undefined;
    context.fillStyle = sentinelColor;
    context.fillStyle = value;
    if (context.fillStyle === sentinelColor) return undefined;
    context.clearRect(0, 0, 1, 1);
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
    return rgbToHex(red, green, blue);
  };
  const colors = { ...fallbackColors };
  for (const key of Object.keys(tokenNames) as (keyof ThemeColors)[]) {
    colors[key] =
      resolve(styles.getPropertyValue(tokenNames[key]).trim()) ?? colors[key];
  }
  return colors;
}

export function buildJBrowseTheme(
  colors: ThemeColors,
  mode: ThemeMode,
  fontFamily: string,
): JBrowseTheme {
  // Dark themes keep --primary a dark fill that reads at 2–3:1 as text
  // (AGENTS.md); JBrowse draws primary as text and icons, so dark uses --link.
  const primary = mode === "dark" ? colors.link : colors.primary;
  return {
    palette: {
      mode,
      primary: { main: primary },
      secondary: { main: colors.secondary },
      tertiary: { main: primary },
      quaternary: { main: colors.secondary },
      background: { default: colors.background, paper: colors.card },
      text: { primary: colors.foreground },
    },
    typography: { fontFamily },
  };
}

export function trackColorsFrom(colors: ThemeColors): GenomeBrowserTrackColors {
  return { PATRIC: colors.chart1, RefSeq: colors.chart2 };
}
