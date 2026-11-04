/**
 * The Circular Viewer's tracks: legacy `CircularViewerContainer`'s defaults
 * in its order (the first is the outermost ring), and the custom and upload
 * tracks `TrackController` added, with their colors and tooltips.
 */
import type { CustomTrackQuery, PresetTrackId } from "./contract";
import type { ScoreScale } from "./paths";
import { userScorePoints, type GcMetric, type TrackItems } from "./track-items";
import type { ParsedUserTrack, UserPlotType } from "./user-track";

export type TrackPlot = "labels" | "sections" | "line" | "histogram" | "heatmap";

export type TrackSource =
  | { kind: "labels" }
  | { kind: "contigs" }
  | { kind: "preset"; preset: PresetTrackId }
  | { kind: "gc"; metric: GcMetric }
  | { kind: "custom"; index: number; query: CustomTrackQuery }
  | { kind: "user"; index: number; plot: UserPlotType; fileName: string; items: TrackItems };

export interface CircularTrack {
  id: string;
  title: string;
  plot: TrackPlot;
  widthFraction: number;
  /** Fill of sections and histograms, stroke of a line, tick color of the labels; null: the theme's. */
  foreground: string | null;
  /**
   * In a dark theme, a lighter version of `foreground` (navy to periwinkle,
   * black to gray): legacy's navy, black, blue and dark purple defaults fall
   * below 3:1 (WCAG 1.4.11) on a dark card. The light theme and an exported
   * figure keep `foreground`; picking a color clears it. Null: `foreground`
   * in every theme.
   */
  darkForeground: string | null;
  background: string | null;
  scale: ScoreScale | null;
  visible: boolean;
  /** Legacy's reference (contig) track had no show/hide or remove button. */
  fixed: boolean;
  source: TrackSource;
}

function presetTrack(
  preset: PresetTrackId,
  title: string,
  foreground: string,
  darkForeground: string | null = null,
): CircularTrack {
  return {
    id: preset,
    title,
    plot: "sections",
    widthFraction: 0.05,
    foreground,
    darkForeground,
    background: null,
    scale: null,
    visible: true,
    fixed: false,
    source: { kind: "preset", preset },
  };
}

function gcTrack(metric: GcMetric, title: string, background: string, scale: ScoreScale): CircularTrack {
  return {
    id: `gc-${metric}`,
    title,
    plot: "line",
    widthFraction: 0.1,
    foreground: "#000000",
    // Drawn on its own light background, in every theme.
    darkForeground: null,
    background,
    scale,
    visible: true,
    fixed: false,
    source: { kind: "gc", metric },
  };
}

export function defaultTracks(): CircularTrack[] {
  return [
    {
      id: "labels",
      title: "Position Label (Mbp)",
      plot: "labels",
      widthFraction: 0.1,
      foreground: null,
      darkForeground: null,
      background: null,
      scale: null,
      visible: true,
      fixed: false,
      source: { kind: "labels" },
    },
    {
      id: "contigs",
      title: "Contigs/Chromosomes",
      plot: "sections",
      widthFraction: 0.03,
      foreground: "#000F7D",
      darkForeground: "#9FA8FF",
      background: null,
      scale: null,
      visible: true,
      fixed: true,
      source: { kind: "contigs" },
    },
    presetTrack("cds-forward", "CDS - FWD", "#307D32"),
    presetTrack("cds-reverse", "CDS - REV", "#833B76", "#D88CCB"),
    presetTrack("non-cds", "Non-CDS Features", "#21DFD7"),
    presetTrack("amr", "AMR Genes", "#FF0000"),
    presetTrack("vf", "VF Genes", "#FFA500"),
    presetTrack("transporter", "Transporters", "#0000FF", "#5C8DFF"),
    presetTrack("drug-target", "Drug Targets", "#000000", "#A6A6A6"),
    gcTrack("content", "GC Content", "#EBD4F4", { min: 0, max: 1 }),
    gcTrack("skew", "GC Skew", "#F3CDA0", { min: -1, max: 1 }),
  ];
}

/** Legacy `custom_colors`: blue, green, orange, pink, red, purple. */
export const customTrackColors = ["#0000FF", "#008000", "#FFA500", "#FFC0CB", "#FF0000", "#800080"] as const;
/** Lighter versions of the cycle colors under 3:1 on a dark card (blue, purple), for `darkForeground`. */
const customDarkForegrounds: Readonly<Record<string, string>> = { "#0000FF": "#5C8DFF", "#800080": "#C08AF5" };
/** Legacy `user_colors`, for uploaded tiles. */
export const userTrackColors = ["#1E90FF", "#32CD32", "#FF6347", "#FF69B4", "#DC143C", "#8A2BE2"] as const;

export function customTrack(index: number, query: CustomTrackQuery, name: string): CircularTrack {
  const foreground = customTrackColors[(index - 1) % customTrackColors.length];
  return {
    id: `custom-${String(index)}`,
    title: name.trim() || query.keyword,
    plot: "sections",
    widthFraction: 0.05,
    foreground,
    darkForeground: customDarkForegrounds[foreground] ?? null,
    background: null,
    scale: null,
    visible: true,
    fixed: false,
    source: { kind: "custom", index, query },
  };
}

/** Legacy `addUserTrack`'s widths and colors per plot type (a histogram's fill was its default blue). */
const userLooks: Record<UserPlotType, { plot: TrackPlot; widthFraction: number; background: string | null }> = {
  tiles: { plot: "sections", widthFraction: 0.08, background: null },
  line: { plot: "line", widthFraction: 0.1, background: "#FFEFD5" },
  histogram: { plot: "histogram", widthFraction: 0.1, background: "#FFFFE0" },
  heatmap: { plot: "heatmap", widthFraction: 0.08, background: null },
};

export function userTrack(
  index: number,
  plot: UserPlotType,
  parsed: ParsedUserTrack,
  fileName: string,
  name: string,
): CircularTrack {
  const look = userLooks[plot];
  const foreground =
    plot === "tiles"
      ? userTrackColors[(index - 1) % userTrackColors.length]
      : plot === "line"
        ? "#000000"
        : plot === "histogram"
          ? "#0000FF"
          : null;
  return {
    id: `user-${String(index)}`,
    title: name.trim() || `User track ${String(index)}`,
    ...look,
    foreground,
    // A line's black and a histogram's blue are drawn on their own light
    // backgrounds (#FFEFD5, #FFFFE0), in every theme, where the theme's
    // foreground would vanish in a dark one.
    darkForeground: null,
    scale: plot === "tiles" ? null : parsed.scale,
    visible: true,
    fixed: false,
    source: {
      kind: "user",
      index,
      plot,
      fileName,
      items:
        plot === "tiles"
          ? { kind: "regions", regions: parsed.items }
          : { kind: "scores", points: userScorePoints(parsed.items) },
    },
  };
}

const presetDescriptions: Record<PresetTrackId, string> = {
  "cds-forward": "CDS forward strand",
  "cds-reverse": "CDS reverse strand",
  "non-cds": "Non-CDS Features",
  amr: "AMR Genes",
  vf: "VF Genes",
  transporter: "Transporters",
  "drug-target": "Drug Targets",
};

function round2(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The tooltip legacy gave a track's title (`title_tooltip`), with the real GC window. */
export function trackDescription(track: CircularTrack, gcWindowSize?: number): string | undefined {
  const { source } = track;
  switch (source.kind) {
    case "labels":
    case "contigs":
      return undefined;
    case "preset":
      return presetDescriptions[source.preset];
    case "gc": {
      const name = source.metric === "content" ? "GC Content" : "GC Skew";
      const range = source.metric === "content" ? "0 - 1" : "-1 - 1";
      return gcWindowSize === undefined
        ? `${name} - plot range: ${range}`
        : `${name} - window size: ${String(gcWindowSize)} nt, plot range: ${range}`;
    }
    case "custom":
      return `Custom track ${String(source.index)} - type: ${source.query.type}, strand: ${source.query.strand}, keyword: ${source.query.keyword}`;
    case "user": {
      const base = `User track ${String(source.index)} - plot type: ${source.plot}, file name: ${source.fileName}`;
      return track.scale === null
        ? base
        : `${base}, plot range: ${round2(track.scale.min)} - ${round2(track.scale.max)}`;
    }
  }
}

/** Legacy hid a heatmap's foreground swatch: its colors are its scores'. */
export function canSetForeground(track: CircularTrack): boolean {
  return track.plot !== "heatmap";
}
