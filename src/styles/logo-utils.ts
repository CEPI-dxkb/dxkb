import { themeBases } from "@/styles/themes";

// Define logo folder mapping for each theme base
const themeLogoMapping: Record<string, string> = {
  zinc: "generic",
  orange: "generic",
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
const logoNamingPatterns: Record<string, Record<LogoVariant, string>> = {
  generic: {
    logo: "xkb-logo.svg",
    "logo-white": "xkb-logo-white.svg",
    "logo-icon": "xkb-logo-icon-white.svg",
    "logo-icon-white": "xkb-logo-icon-white.svg",
    "logo-text-white": "xkb-logo-white.svg", // Fallback to regular white logo
    "sponsor-logo": "../cepi/cepi-logo.svg",
    "sponsor-logo-white": "../cepi/cepi-logo-white.svg",
  },
  dxkb: {
    logo: "dxkb-logo.svg",
    "logo-white": "dxkb-logo-white.svg",
    "logo-icon": "dxkb-logo-icon.svg",
    "logo-icon-white": "dxkb-logo-icon.svg", // Using regular icon for now
    "logo-text-white": "dxkb-text-white.svg",
    "sponsor-logo": "../cepi/cepi-logo.svg",
    "sponsor-logo-white": "../cepi/cepi-logo-white.svg",
  },
  bvbrc: {
    logo: "bvbrc-logo.svg",
    "logo-white": "bvbrc-logo-white.svg",
    "logo-icon": "bvbrc-logo-icon.svg",
    "logo-icon-white": "bvbrc-logo-icon-white.svg",
    "logo-text-white": "bvbrc-logo-white.svg", // Fallback to regular white logo
    "sponsor-logo": "../cepi/cepi-logo.svg",
    "sponsor-logo-white": "../cepi/cepi-logo-white.svg",
  },
};

/**
 * Get the logo folder path for a given theme
 */
export function getLogoFolder(theme: string): string {
  const themeBase = themeBases.find((base) => theme.includes(base));
  return themeLogoMapping[themeBase || "dxkb"] || "dxkb";
}

/**
 * Get the full logo path for a given theme and variant
 */
export function getLogoPath(theme: string, variant: LogoVariant): string {
  const folder = getLogoFolder(theme);
  const fileName =
    logoNamingPatterns[folder]?.[variant] || logoNamingPatterns.dxkb[variant];
  return `/logos/${folder}/${fileName}`;
}

/**
 * Get logo paths for all variants of a theme
 */
export function getThemeLogos(theme: string): Record<LogoVariant, string> {
  return {
    logo: getLogoPath(theme, "logo"),
    "logo-white": getLogoPath(theme, "logo-white"),
    "logo-icon": getLogoPath(theme, "logo-icon"),
    "logo-icon-white": getLogoPath(theme, "logo-icon-white"),
    "logo-text-white": getLogoPath(theme, "logo-text-white"),
    "sponsor-logo": "/logos/cepi/cepi-logo.svg",
    "sponsor-logo-white": "/logos/cepi/cepi-logo-white.svg",
  };
}

/**
 * Add a new theme and its logo folder mapping
 */
export function addThemeLogoMapping(
  themeBase: string,
  logoFolder: string,
): void {
  themeLogoMapping[themeBase] = logoFolder;
}

/**
 * Add custom logo naming patterns for a folder
 */
export function addLogoNamingPattern(
  folder: string,
  patterns: Record<LogoVariant, string>,
): void {
  logoNamingPatterns[folder] = patterns;
}
