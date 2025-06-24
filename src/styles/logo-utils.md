# Logo Utility System

This system provides a modular way to switch logos based on themes.

## Usage

### Basic Usage with Logo Component

```tsx
import Logo from "@/components/ui/logo";

// Use the Logo component - it automatically switches based on theme
<Logo variant="logo-white" width={100} height={40} />;
```

### Available Logo Variants

- `logo` - Regular logo
- `logo-white` - White version of logo
- `logo-icon` - Icon version of logo
- `logo-icon-white` - White icon version
- `logo-text-white` - Text-only white version (for footers, etc.)

### Direct Utility Usage

```tsx
import { getLogoPath, getThemeLogos } from "@/lib/logo-utils";

// Get a specific logo path
const logoPath = getLogoPath("dxkb-light", "logo-white");

// Get all logo variants for a theme
const allLogos = getThemeLogos("bvbrc-dark");
```

## Adding New Themes

### 1. Add Theme Base

First, add your new theme base to `src/styles/themes.ts`:

```tsx
export const themeBases = [
  "zinc",
  "orange",
  "violet",
  "dxkb",
  "bvbrc",
  "your-new-theme",
];
```

### 2. Add Logo Folder Mapping

Add the mapping in `src/lib/logo-utils.ts`:

```tsx
const themeLogoMapping: Record<string, string> = {
  zinc: "generic",
  orange: "generic",
  violet: "generic",
  dxkb: "dxkb",
  bvbrc: "bvbrc",
  "your-new-theme": "your-logo-folder", // Add this line
};
```

### 3. Add Logo Naming Patterns

Add the naming patterns for your logo files:

```tsx
const logoNamingPatterns: Record<string, Record<LogoVariant, string>> = {
  // ... existing patterns
  "your-logo-folder": {
    logo: "your-logo.svg",
    "logo-white": "your-logo-white.svg",
    "logo-icon": "your-logo-icon.svg",
    "logo-icon-white": "your-logo-icon-white.svg",
    "logo-text-white": "your-logo-text-white.svg", // or fallback to logo-white
  },
};
```

### 4. Place Logo Files

Put your logo files in `public/logos/your-logo-folder/` with the exact names specified in the patterns.

## Programmatic Addition

You can also add themes programmatically:

```tsx
import { addThemeLogoMapping, addLogoNamingPattern } from "@/lib/logo-utils";

// Add theme mapping
addThemeLogoMapping("new-theme", "new-logo-folder");

// Add naming patterns
addLogoNamingPattern("new-logo-folder", {
  logo: "new-logo.svg",
  "logo-white": "new-logo-white.svg",
  "logo-icon": "new-logo-icon.svg",
  "logo-icon-white": "new-logo-icon-white.svg",
  "logo-text-white": "new-logo-text-white.svg",
});
```

## Current Theme Mappings

- `zinc`, `orange`, `violet` → `generic` folder
- `dxkb` → `dxkb` folder
- `bvbrc` → `bvbrc` folder

## File Structure Requirements

Each logo folder should contain these variants:

- `logo.svg` - Regular logo
- `logo-white.svg` - White version
- `logo-icon.svg` - Icon version
- `logo-icon-white.svg` - White icon version
- `logo-text-white.svg` - Text-only white version (optional, falls back to logo-white)

The system will fallback to the dxkb folder if a logo file is not found.
