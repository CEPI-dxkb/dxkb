export type Srgb = [number, number, number];

/** Converts an `oklch(L C H)` literal to gamma-encoded sRGB, clipped to the gamut. */
export function oklchToSrgb(value: string): Srgb {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(
    value.trim(),
  );
  if (!match) throw new Error(`Not an oklch() literal: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [red, green, blue] = linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  });
  return [red, green, blue];
}

function relativeLuminance([red, green, blue]: Srgb): number {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two `oklch()` literals. */
export function oklchContrast(first: string, second: string): number {
  const [lighter, darker] = [first, second]
    .map((color) => relativeLuminance(oklchToSrgb(color)))
    .sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
