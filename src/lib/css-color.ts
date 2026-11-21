/** A fill no theme token uses, to tell an invalid color from black. */
const sentinelColor = "#010203";

export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * A CSS color as `#rrggbb`, resolved by the browser through a 1x1 canvas pixel, for libraries that
 * cannot parse the theme's `oklch()` tokens (MUI, Sigma). Undefined for an empty or invalid value,
 * or where there is no 2D canvas; callers pick their own fallback.
 */
export function resolveCssColor(value: string): string | undefined {
  if (value === "") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.fillStyle = sentinelColor;
  context.fillStyle = value;
  if (context.fillStyle === sentinelColor) return undefined;
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
  return rgbToHex(red, green, blue);
}
