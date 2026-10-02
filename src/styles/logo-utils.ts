// Define logo folder mapping for each theme base
const themeLogoMapping: Record<string, string> = {
  violet: "generic",
  dxkb: "dxkb",
  bvbrc: "bvbrc",
};

// Logo variants available for each theme
export type LogoVariant =
  | "logo"
  | "logo-white"
  | "logo-icon"
  | "logo-icon-white"
  | "logo-text-white"
  | "sponsor-logo"
  | "sponsor-logo-white";

// Define logo naming patterns for each folder
const logoNamingPatterns: Partial<Record<string, Record<LogoVariant, string>>> =
  {
    generic: {
      logo: "xkb-logo.svg",
      "logo-white": "xkb-logo-white.svg",
      "logo-icon": "xkb-logo-icon-white.svg",
      "logo-icon-white": "xkb-logo-icon-white.svg",
      "logo-text-white": "xkb-logo-white.svg", // Fallback to regular white logo
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
    dxkb: {
      logo: "dxkb-logo.svg",
      "logo-white": "dxkb-logo-white.svg",
      "logo-icon": "dxkb-logo-icon.svg",
      "logo-icon-white": "dxkb-logo-icon.svg", // Using regular icon for now
      "logo-text-white": "dxkb-text-white.svg",
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
    bvbrc: {
      logo: "bvbrc-logo.svg",
      "logo-white": "bvbrc-logo-white.svg",
      "logo-icon": "bvbrc-logo-icon.svg",
      "logo-icon-white": "bvbrc-logo-icon-white.svg",
      "logo-text-white": "bvbrc-logo-white.svg", // Fallback to regular white logo
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
  };

/**
 * Get the logo folder path for a given theme
 */
export function getLogoFolder(theme: string): string {
  const themeBase = theme.split("-", 1)[0] ?? "dxkb";
  return themeLogoMapping[themeBase] ?? "dxkb";
}

/**
 * Get the full logo path for a given theme and variant
 */
export function getLogoPath(theme: string, variant: LogoVariant): string {
  const folder = getLogoFolder(theme);
  const fileName =
    logoNamingPatterns[folder]?.[variant] ??
    logoNamingPatterns.dxkb?.[variant] ??
    "";
  return `/logos/${folder}/${fileName}`;
}
