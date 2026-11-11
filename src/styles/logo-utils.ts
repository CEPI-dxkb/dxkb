const themeLogoMapping: Record<string, string> = {
  violet: "generic",
  dxkb: "dxkb",
  bvbrc: "bvbrc",
};

export type LogoVariant =
  | "logo"
  | "logo-white"
  | "logo-icon"
  | "logo-icon-white"
  | "logo-text-white"
  | "sponsor-logo"
  | "sponsor-logo-white";

const logoNamingPatterns: Partial<Record<string, Record<LogoVariant, string>>> =
  {
    generic: {
      logo: "xkb-logo.svg",
      "logo-white": "xkb-logo-white.svg",
      "logo-icon": "xkb-logo-icon-white.svg",
      "logo-icon-white": "xkb-logo-icon-white.svg",
      "logo-text-white": "xkb-logo-white.svg",
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
    dxkb: {
      logo: "dxkb-logo.svg",
      "logo-white": "dxkb-logo-white.svg",
      "logo-icon": "dxkb-logo-icon.svg",
      "logo-icon-white": "dxkb-logo-icon.svg",
      "logo-text-white": "dxkb-text-white.svg",
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
    bvbrc: {
      logo: "bvbrc-logo.svg",
      "logo-white": "bvbrc-logo-white.svg",
      "logo-icon": "bvbrc-logo-icon.svg",
      "logo-icon-white": "bvbrc-logo-icon-white.svg",
      "logo-text-white": "bvbrc-logo-white.svg",
      "sponsor-logo": "@public/logos/cepi/cepi-logo.svg",
      "sponsor-logo-white": "@public/logos/cepi/cepi-logo-white.svg",
    },
  };

export function getLogoFolder(theme: string): string {
  const themeBase = theme.split("-", 1)[0] ?? "dxkb";
  return themeLogoMapping[themeBase] ?? "dxkb";
}

export function getLogoPath(theme: string, variant: LogoVariant): string {
  const folder = getLogoFolder(theme);
  const fileName =
    logoNamingPatterns[folder]?.[variant] ??
    logoNamingPatterns.dxkb?.[variant] ??
    "";
  return `/logos/${folder}/${fileName}`;
}
