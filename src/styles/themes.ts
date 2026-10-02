export const themeBases = ["dxkb", "bvbrc", "violet"] as const;
export type ThemeBase = (typeof themeBases)[number];

export const themeModes = ["light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];

export const themeLabels: Record<ThemeBase, string> = {
  dxkb: "DXKB",
  bvbrc: "BV-BRC",
  violet: "Violet",
};

export const defaultThemeBase: ThemeBase = "dxkb";
export const defaultTheme = `${defaultThemeBase}-light`;

export const themeList: string[] = themeBases.flatMap((base) =>
  themeModes.map((mode) => `${base}-${mode}`),
);

function isThemeBase(value: string): value is ThemeBase {
  return (themeBases as readonly string[]).includes(value);
}

/**
 * Split a next-themes value ("bvbrc-dark") into its base and mode. A base that
 * is not offered any more (a retired theme still in someone's storage) reads
 * as the default base, keeping the mode.
 */
export function parseTheme(theme: string | undefined): {
  base: ThemeBase;
  mode: ThemeMode;
} {
  const value = theme ?? defaultTheme;
  const dashIdx = value.lastIndexOf("-");
  const base = dashIdx > 0 ? value.slice(0, dashIdx) : "";
  const mode = dashIdx > 0 ? value.slice(dashIdx + 1) : "";
  return {
    base: isThemeBase(base) ? base : defaultThemeBase,
    mode: mode === "dark" ? "dark" : "light",
  };
}
