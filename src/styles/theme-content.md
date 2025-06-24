# Theme Content System

This system provides a modular way to switch text content based on themes, similar to the logo system.

## Usage

### Basic Usage with ThemeContent Component

```tsx
import ThemeContent from "@/components/ui/theme-content";

// Use the ThemeContent component - it automatically switches based on theme
<ThemeContent type="welcome-title" as="h1" className="text-2xl" />;
```

### Available Content Types

- `welcome-title` - Main welcome heading
- `welcome-subtitle` - Welcome description/subtitle
- `site-name` - Site name/title
- `site-description` - Site description

### Direct Utility Usage

```tsx
import { getThemeContent, getAllThemeContent } from "@/lib/theme-content";

// Get specific content for a theme
const title = getThemeContent("dxkb-light", "welcome-title");

// Get all content for a theme
const allContent = getAllThemeContent("bvbrc-dark");
```

## Current Theme Content

### Generic Themes (zinc, orange, violet)

- **Welcome Title**: "Welcome to the XKnowledge Base"
- **Welcome Subtitle**: "Access detailed information on viral genomes, proteins, and biological data to accelerate your research and discoveries."
- **Site Name**: "XKnowledge Base"
- **Site Description**: "A comprehensive knowledge base for viral and bacterial research."

### DXKB Theme

- **Welcome Title**: "Welcome to the Disease X Knowledge Base"
- **Welcome Subtitle**: "Access detailed information on viral genomes, proteins, and biological data to accelerate your research and discoveries."
- **Site Name**: "Disease X Knowledge Base"
- **Site Description**: "A comprehensive knowledge base for viral research and disease prevention."

### BVBRC Theme

- **Welcome Title**: "Welcome to the Bacterial and Viral Bioinformatics Resource Center (BV-BRC)"
- **Welcome Subtitle**: "Access comprehensive bacterial and viral genomic data, analysis tools, and bioinformatics resources to accelerate your research."
- **Site Name**: "BV-BRC"
- **Site Description**: "The Bacterial and Viral Bioinformatics Resource Center provides comprehensive data and analysis tools for bacterial and viral research."

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

### 2. Add Content Folder Mapping

Add the mapping in `src/lib/theme-content.ts`:

```tsx
const themeContentMapping: Record<string, string> = {
  zinc: "generic",
  orange: "generic",
  violet: "generic",
  dxkb: "dxkb",
  bvbrc: "bvbrc",
  "your-new-theme": "your-content-folder", // Add this line
};
```

### 3. Add Content

Add the content for your theme:

```tsx
const themeContent: Record<string, Record<ContentType, string>> = {
  // ... existing content
  "your-content-folder": {
    "welcome-title": "Welcome to Your Custom Platform",
    "welcome-subtitle": "Your custom welcome message here.",
    "site-name": "Your Platform Name",
    "site-description": "Your platform description.",
  },
};
```

## Programmatic Addition

You can also add themes programmatically:

```tsx
import { addThemeContentMapping, addThemeContent } from "@/lib/theme-content";

// Add theme mapping
addThemeContentMapping("new-theme", "new-content-folder");

// Add content
addThemeContent("new-content-folder", {
  "welcome-title": "Welcome to New Platform",
  "welcome-subtitle": "New platform description.",
  "site-name": "New Platform",
  "site-description": "New platform full description.",
});
```

## Component Props

The `ThemeContent` component accepts:

- `type`: ContentType - The type of content to display
- `className`: string (optional) - CSS classes
- `as`: React.ElementType (optional) - HTML element to render as (default: "span")

## Examples

```tsx
// As a heading
<ThemeContent type="welcome-title" as="h1" className="text-3xl font-bold" />

// As a paragraph
<ThemeContent type="welcome-subtitle" as="p" className="text-lg" />

// As a span (default)
<ThemeContent type="site-name" />

// In a button
<Button>
  <ThemeContent type="site-name" />
</Button>
```

## Integration with Logo System

This content system works seamlessly with the logo system. Both systems:

- Use the same theme detection logic
- Handle hydration properly to prevent SSR mismatches
- Support the same theme bases
- Are modular and extensible

The system will fallback to the dxkb content if a theme is not found.
