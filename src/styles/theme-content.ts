import { themeBases } from "@/styles/themes";

// Define theme-to-folder mapping for content
const themeContentMapping: Record<string, string> = {
  zinc: "generic",
  orange: "generic",
  violet: "generic",
  dxkb: "dxkb",
  bvbrc: "bvbrc",
};

// Content types available for each theme
export type ContentType =
  | "welcome-title"
  | "welcome-subtitle"
  | "site-name"
  | "site-description"
  | "funding-title"
  | "funding-statement";

// Define content for each theme
const themeContent: Record<string, Record<ContentType, string>> = {
  generic: {
    "welcome-title": "Welcome to the XKnowledge Base",
    "welcome-subtitle":
      "Access detailed information on viral genomes, proteins, and biological data to accelerate your research and discoveries.",
    "site-name": "XKnowledge Base",
    "site-description":
      "A comprehensive knowledge base for viral and bacterial research.",
    "funding-title": "An Initiative.",
    "funding-statement":
      "This project is funded in whole or in parts with money.",
  },
  dxkb: {
    "welcome-title": "Welcome to the Disease X Knowledge Base",
    "welcome-subtitle":
      "Access detailed information on viral genomes, proteins, and biological data to accelerate your research and discoveries.",
    "site-name": "Disease X Knowledge Base",
    "site-description":
      "A comprehensive knowledge base for viral research and disease prevention.",
    "funding-title": "A CEPI Initiative.",
    "funding-statement":
      "This project is funded in whole or in parts with Federal funds using grants awarded to the University of Chicago.",
  },
  bvbrc: {
    "welcome-title":
      "Welcome to the Bacterial and Viral Bioinformatics Resource Center (BV-BRC)",
    "welcome-subtitle":
      "Access comprehensive bacterial and viral genomic data, analysis tools, and bioinformatics resources to accelerate your research.",
    "site-name": "BV-BRC",
    "site-description":
      "The Bacterial and Viral Bioinformatics Resource Center provides comprehensive data and analysis tools for bacterial and viral research.",
    "funding-title": "BRC Program",
    "funding-statement":
      "This project has been funded in whole or in part with Federal funds from the National Institute of Allergy and Infectious Diseases, National Institutes of Health, Department of Health and Human Services, under Grant No. U24AI183849, awarded to the University of Chicago.",
  },
};

/**
 * Get the content folder for a given theme
 */
export function getContentFolder(theme: string): string {
  const themeBase = themeBases.find((base) => theme.includes(base));
  return themeContentMapping[themeBase || "dxkb"] || "dxkb";
}

/**
 * Get content for a given theme and content type
 */
export function getThemeContent(
  theme: string,
  contentType: ContentType,
): string {
  const folder = getContentFolder(theme);
  return themeContent[folder]?.[contentType] || themeContent.dxkb[contentType];
}

/**
 * Get all content for a theme
 */
export function getAllThemeContent(theme: string): Record<ContentType, string> {
  const folder = getContentFolder(theme);
  return themeContent[folder] || themeContent.dxkb;
}

/**
 * Add a new theme and its content mapping
 */
export function addThemeContentMapping(
  themeBase: string,
  contentFolder: string,
): void {
  themeContentMapping[themeBase] = contentFolder;
}

/**
 * Add custom content for a theme folder
 */
export function addThemeContent(
  folder: string,
  content: Record<ContentType, string>,
): void {
  themeContent[folder] = content;
}
