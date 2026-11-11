// Shared chart palette; charts needing fewer colors `slice()` it.
export const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

export const donutFallbackColor = "var(--muted-foreground)";

/**
 * Fixed-position tooltip style that flips when it would overflow the viewport;
 * a horizontal flip returns `right`, so no width estimation is needed.
 */
export function chartTooltipStyle(
  cx: number,
  cy: number,
  estimatedWidth: number,
  estimatedHeight: number,
  offsetX = 12,
  offsetY = -36,
): { left?: number; right?: number; top: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
  const vh = typeof window !== "undefined" ? window.innerHeight : 9999;

  const flipX = cx + offsetX + estimatedWidth > vw;
  const xStyle = flipX
    ? { right: vw - cx + offsetX }
    : { left: cx + offsetX };

  const top =
    cy + offsetY < 0
      ? cy + Math.abs(offsetY)
      : cy + offsetY + estimatedHeight > vh
        ? cy - Math.abs(offsetY) - estimatedHeight
        : cy + offsetY;

  return { ...xStyle, top };
}
