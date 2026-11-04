/** Legacy `HeatmapTrack.getHeatmapColor`'s palettes, lightest first. */
export const heatmapPositiveColors = [
  "#FFEBEE", "#FFCDD2", "#EF9A9A", "#E57373", "#EF5350",
  "#F44336", "#E53935", "#D32F2F", "#C62828", "#B71C1C",
] as const;

export const heatmapNegativeColors = [
  "#E8EAF6", "#C5CAE9", "#9FA8DA", "#7986CB", "#5C6BC0",
  "#3F51B5", "#3949AB", "#303F9F", "#283593", "#1A237E",
] as const;

/**
 * `score / max` in tenths: red for positive shares, blue for negative ones,
 * each bucket closed at its upper magnitude (0.1 is the first). A share of
 * exactly 0 is the lightest red; legacy fell through to plain `red`.
 */
export function heatmapColor(score: number, max: number): string {
  const share = max === 0 ? 0 : score / max;
  const colors = share < 0 ? heatmapNegativeColors : heatmapPositiveColors;
  const bucket = Math.ceil(Math.abs(share) * 10) - 1;
  return colors[Math.min(Math.max(bucket, 0), colors.length - 1)];
}
