import { resolveCssColor } from "@/lib/css-color";
import type { GenomeBrowserAnnotation } from "@/lib/genome-browser/contract";
import type { ThemeMode } from "@/styles/themes";

/**
 * The tokens are oklch, which MUI cannot parse, so they are resolved to hex
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

export function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const colors = { ...fallbackColors };
  for (const key of Object.keys(tokenNames) as (keyof ThemeColors)[]) {
    colors[key] =
      resolveCssColor(styles.getPropertyValue(tokenNames[key]).trim()) ??
      colors[key];
  }
  return colors;
}

export function buildJBrowseTheme(
  colors: ThemeColors,
  mode: ThemeMode,
  fontFamily: string,
): JBrowseTheme {
  // Dark themes keep --primary at 2-3:1 as text, and JBrowse draws primary as
  // text and icons, so dark uses --link.
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
