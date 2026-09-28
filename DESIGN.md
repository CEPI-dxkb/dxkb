# DXKB Design Reference

This document is the single source of truth for UI design decisions in this codebase. All developers and AI agents must follow these guidelines to keep the application visually consistent.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Technology Stack](#technology-stack)
3. [Theming System](#theming-system)
4. [Color Tokens](#color-tokens)
5. [Typography](#typography)
6. [Icons](#icons)
7. [Components](#components)
8. [Layout Patterns](#layout-patterns)
9. [Forms](#forms)
10. [Feedback & State](#feedback--state)
11. [CSS Utility Classes](#css-utility-classes)
12. [Anti-Patterns](#anti-patterns)

---

## Core Principles

- **No emojis.** Never use emoji characters anywhere in the UI — in labels, headings, descriptions, toasts, or button text. Use `lucide-react` icons instead.
- **Use CSS variables.** Always reach for semantic color tokens (e.g., `text-foreground`, `bg-muted`) rather than hard-coded Tailwind palette values (e.g., `text-gray-600`, `bg-blue-500`).
- **Respect the theme.** Every color, radius, and shadow must work in both the light and dark variants of every theme. Test both before shipping.
- **Use the existing component library.** Before writing custom markup, check `src/components/ui/` for an existing shadcn/ui component. Do not reach for HTML elements when a component exists.
- **New components must use shadcn + Base UI.** When adding a component that does not yet exist in `src/components/ui/`, always check the [shadcn/ui Base UI catalogue](https://ui.shadcn.com/docs/components/base) first. If a Base UI-backed shadcn component exists for the primitive you need, use it — do not reach for Radix UI, Headless UI, or a custom implementation. The entire component library is being migrated to `@base-ui/react`; every new component must stay consistent with that direction.
- **Consistent spacing.** Use Tailwind spacing utilities. Do not write arbitrary pixel values in `style={{}}` props unless absolutely required by a third-party library.
- **One icon library.** All icons come from `lucide-react`. Never mix in other icon sets.

---

## Technology Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC + client components |
| Styling | Tailwind CSS v4 | CSS variable-based theming |
| Component base | shadcn/ui (New York style, slate base) | Wraps `@base-ui/react` primitives |
| Primitive layer | `@base-ui/react` | Headless UI — used under all shadcn components |
| Icons | `lucide-react` | Only icon library allowed |
| Toast notifications | `sonner` | Pre-configured in root layout |
| Forms | `@tanstack/react-form` + zod | See [Forms](#forms) |
| Data tables | `@tanstack/react-table` + `@tanstack/react-virtual` | Used in workspace browser |
| Theming | `next-themes` | Theme stored as `data-theme` attribute |
| Class composition | `clsx` + `tailwind-merge` via `cn()` | `import { cn } from "@/lib/utils"` |
| Variants | `class-variance-authority` (`cva`) | Used inside all component files |

---

## Theming System

Themes are CSS `data-theme` attribute selectors defined in `src/app/globals.css` and imported theme files. The active theme is applied to the `<html>` element by `next-themes`.

### Available Themes

| Theme key | File | Description |
|---|---|---|
| `dxkb-light` | `globals.css` | **Default.** Blue primary, orange secondary, gold accent, rounded |
| `dxkb-dark` | `globals.css` | Dark variant of dxkb |
| `bvbrc-light` | `src/styles/themes/bvbrc-theme.css` | BV-BRC brand, minimal radius |
| `bvbrc-dark` | `src/styles/themes/bvbrc-theme.css` | BV-BRC dark |
| `zinc-light` | `src/styles/themes/zinc-theme.css` | Near-zero radius, monochromatic |
| `zinc-dark` | `src/styles/themes/zinc-theme.css` | Zinc dark |
| `orange-light` | `src/styles/themes/orange-theme.css` | Orange primary |
| `orange-dark` | `src/styles/themes/orange-theme.css` | Orange dark |
| `violet-light` | `src/styles/themes/violet-theme.css` | Violet primary |
| `violet-dark` | `src/styles/themes/violet-theme.css` | Violet dark |

Dark mode is enabled via the custom Tailwind variant:

```css
@custom-variant dark (&:is([data-theme$="-dark"] *));
```

This means the `dark:` prefix in Tailwind works against any theme ending in `-dark`.

### Radius Scale

Radius is controlled per-theme through the `--radius` variable:

```
--radius-sm  = calc(var(--radius) - 4px)
--radius-md  = calc(var(--radius) - 2px)
--radius-lg  = var(--radius)             ← default border-radius for most components
--radius-xl  = calc(var(--radius) + 4px)
```

Do not hard-code `rounded-md` where `rounded-lg` (the theme default) is appropriate. The `dxkb` themes use `0.65rem` (light) and `1rem` (dark).

---

## Color Tokens

All colors are defined as CSS custom properties using the `oklch` color space. Reference them only through Tailwind utility classes (e.g., `bg-primary`, `text-muted-foreground`) — never use the raw `oklch(...)` values in JSX.

### Semantic Tokens

| Token | Tailwind class | Meaning |
|---|---|---|
| `--background` | `bg-background` / `text-background` | Page background |
| `--foreground` | `text-foreground` | Body text |
| `--card` | `bg-card` | Card / panel surface |
| `--card-foreground` | `text-card-foreground` | Text inside cards |
| `--popover` | `bg-popover` | Dropdown / popover background |
| `--popover-foreground` | `text-popover-foreground` | Text inside popovers |
| `--primary` | `bg-primary` / `text-primary` | Brand color; navbar, primary buttons |
| `--primary-foreground` | `text-primary-foreground` | Text on primary backgrounds |
| `--secondary` | `bg-secondary` / `text-secondary` | Accent / highlight color |
| `--secondary-foreground` | `text-secondary-foreground` | Text on secondary backgrounds |
| `--muted` | `bg-muted` | Subtle backgrounds (inputs, skeletons) |
| `--muted-foreground` | `text-muted-foreground` | Descriptive / helper text |
| `--accent` | `bg-accent` / `text-accent` | Tertiary highlight |
| `--accent-foreground` | `text-accent-foreground` | Text on accent backgrounds |
| `--destructive` | `bg-destructive` / `text-destructive` | Errors, delete actions |
| `--border` | `border-border` | Default border color |
| `--input` | `bg-input` | Form input background |
| `--ring` | `ring-ring` | Focus ring color |
| `--chart-1` through `--chart-5` | `bg-chart-1`, etc. | Data visualization palette |

### dxkb-light Concrete Values (for reference only)

| Token | Value | Approximate visual |
|---|---|---|
| `--primary` | `oklch(45.57% 0.137 266.75)` | Medium blue |
| `--secondary` | `oklch(71.57% 0.182 37.18)` | Orange |
| `--accent` | `oklch(84.57% 0.167 84.87)` | Gold / amber |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Red |
| `--muted` | `oklch(0.92 0 0)` | Light gray |
| `--muted-foreground` | `oklch(0.556 0 0)` | Medium gray |

### Sidebar Tokens

Sidebar-specific tokens (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, etc.) exist for potential sidebar layouts and are already wired into Tailwind via `@theme inline`. Use `bg-sidebar`, `text-sidebar-foreground`, etc. when building sidebar components.

### Allowed Hard-coded Colors

The only colors allowed outside the token system are in specific legacy contexts already present in the codebase:

- `text-blue-600` / `text-blue-400` — used for external hyperlinks (`.link`, `.news-link`, `.service-header a`)
- `text-red-500` — required field asterisks only (`RequiredFormCardTitle`, `RequiredFormLabel`)
- `bg-gray-50`, `bg-gray-100`, `divide-gray-200` — service table header/body (`.service-table-*`)

When adding new UI, use the token system. Do not extend the hard-coded color list.

---

## Typography

### Fonts

Two variable fonts are loaded globally and set as CSS variables:

| Variable | Font | Usage |
|---|---|---|
| `--font-geist-sans` (Geist) | `font-sans` | All body text, UI labels, headings |
| `--font-geist-mono` (Geist Mono) | `font-mono` | Code blocks, FASTA/sequence textareas |

The base font stack is applied in `globals.css`:

```css
:root { font-family: var(--font-sans); }
pre, code { font-family: var(--font-mono); }
```

### Text Scale

Use Tailwind's default text scale. Common usages in the codebase:

| Size | Class | Where used |
|---|---|---|
| 12px | `text-xs` | Badges, captions, timeline labels |
| 13px | `text-[13px]` | Mobile nav items |
| 14px | `text-sm` | Form labels, table cells, card descriptions |
| 16px | `text-base` | Card titles, body text |
| 18px | `text-lg` | Section headers, collapsible triggers |
| 20px | `text-xl` | Citation card titles |
| 24px | `text-2xl` | Stat values, section headers |
| 30px | `text-3xl` | Page headings (most pages) |
| 36px | `text-4xl` | Service page main title |

### Heading Conventions

- Page-level heading: `text-3xl font-bold` or `text-4xl font-bold` wrapped in `<h1>`
- Section heading: `text-lg font-semibold` in card titles / collapsible triggers
- Sub-label / description: `text-muted-foreground` at `text-sm`

---

## Icons

**Use `lucide-react` exclusively.** Never use emoji, inline SVG, or any other icon library for UI icons.

### Import Pattern

```tsx
import { SearchIcon, ChevronDownIcon, Trash2 } from "lucide-react"
```

### Sizing

Icons are sized via Tailwind `size-*` utilities:

| Use case | Class |
|---|---|
| Inline with text (default) | `size-4` (16px) — shadcn/ui default |
| Small inline | `size-3` (12px) |
| Large standalone | `size-5` or `size-6` |
| Spinner | `size-4 animate-spin` |
| Tooltip trigger | `size-4 text-muted-foreground` |
| Service header tooltip | `h-5 w-5 text-blue-500` (`.service-header-tooltip`) |
| Card metric icon | `h-4 w-4 text-muted-foreground` |

Shadcn/ui button components automatically size SVGs via `[&_svg:not([class*='size-'])]:size-4`. Only apply an explicit `size-*` class when the default is wrong.

### Common Icons by Semantic Purpose

| Purpose | Icon |
|---|---|
| External link | `ExternalLink` |
| Delete / remove | `Trash2` |
| Add / create | `Plus` |
| Search | `Search` / `SearchIcon` |
| Loading / spinner | `Loader2Icon` (with `animate-spin`) |
| Info / tooltip | `InfoIcon` |
| Warning | `TriangleAlertIcon` |
| Error | `OctagonXIcon` |
| Success | `CircleCheckIcon` |
| Close / dismiss | `X` / `XIcon` |
| Edit | `Pencil` |
| Copy | `Copy` / `ClipboardCopy` |
| Download | `Download` |
| Upload | `Upload` |
| Sort ascending | `ArrowUp` |
| Sort descending | `ArrowDown` |
| Sort toggle | `ArrowUpDown` |
| Expand / collapse | `ChevronDown` / `ChevronUp` |
| Navigate left | `ChevronLeft` / `ArrowLeft` |
| Navigate right | `ChevronRight` / `ArrowRight` |
| Calendar | `CalendarIcon` |
| Refresh | `RefreshCw` |
| Settings | none — use `Palette` or `Settings` |
| User | `User` |
| Sign out | `LogOut` |
| Lock | `Lock` |
| Panel open/close | `PanelRightOpen` / `PanelRightClose` |

### Social Icons

Social platform icons are reviewed inline SVG paths in the footer. Do not add a brand-icon package for these static marks.

### Biology Icons

Domain-specific biology icons (genome diagrams, enzyme structures, protein shapes, sequence visualizations, etc.) that have no adequate equivalent in `lucide-react` are a second exception. Two sources are allowed:

**1. Custom SVGs committed to `public/icons/`**

The preferred approach for one-off biology icons. Add the SVG file to `public/icons/` and import it as a React component via the `@public/` alias (handled by `@svgr/webpack`):

```tsx
import GenomeIcon  from "@public/icons/genome.svg"
import ProteinIcon from "@public/icons/protein.svg"
import EnzymeIcon  from "@public/icons/enzyme.svg"
import SequenceIcon from "@public/icons/sequence.svg"
import PipelineIcon from "@public/icons/pipeline.svg"
```

SVGs committed to `public/icons/` **must** use `fill="currentColor"` (or `stroke="currentColor"` for stroke-based artwork) so they inherit the surrounding text color and respond to theme changes correctly. Do not hard-code `fill="#000"` or any hex value inside the SVG markup.

Usage is identical to any other icon — size with Tailwind `size-*` utilities:

```tsx
<GenomeIcon className="size-8 text-primary" />
<ProteinIcon className="size-6 text-muted-foreground" />
```

Currently committed biology icons:

| File | Description |
|---|---|
| `public/icons/genome.svg` | Double-helix / genome visualization |
| `public/icons/enzyme.svg` | Enzyme structure |
| `public/icons/protein.svg` | Protein structure |
| `public/icons/protein-alt.svg` | Alternate protein representation |
| `public/icons/sequence.svg` | Sequence / read visualization |
| `public/icons/pipeline.svg` | Pipeline / workflow diagram |
| `public/icons/planning.svg` | Planning / tree diagram |

**2. A dedicated third-party biology icon library**

If a larger set of biology icons is needed (e.g., for a new organism browser or visualization page), a dedicated library such as [BioIcons](https://bioicons.com) can be sourced and its SVGs committed to `public/icons/` following the same `fill="currentColor"` convention. Do not import a runtime icon library dependency solely for biology icons — commit the SVG files directly instead, which keeps the bundle lean and the icons tree-shakeable.

**What still comes from `lucide-react`**

Lucide does include a small set of science-adjacent icons that are sufficient for generic concepts:

| Icon | Use case |
|---|---|
| `Dna` | Generic genomics / biology label |
| `Microscope` | Research / lab context |
| `FlaskConical` | Wet-lab or experiment context |
| `Atom` | Molecular / chemistry context |

Reach for `lucide-react` first for these generic cases. Only go to `public/icons/` or a biology library when lucide has nothing close.

---

## Components

All components live in `src/components/ui/` and are built on `@base-ui/react` primitives. Import them using the `@/` alias.

### Adding New Components

Before building any new UI primitive from scratch, follow this decision order:

1. **Check `src/components/ui/`** — the component may already exist.
2. **Check the shadcn/ui Base UI catalogue** at `https://ui.shadcn.com/docs/components/base` — if a Base UI-backed shadcn component exists, install it via the shadcn CLI and it will land in `src/components/ui/` automatically.
3. **Build on `@base-ui/react` directly** — if no shadcn component exists yet but `@base-ui/react` exports a suitable headless primitive, wrap it following the same pattern as existing components in `src/components/ui/` (use `cva` for variants, `cn()` for class merging, forward a `data-slot` attribute).
4. **Only as a last resort** build a fully custom component — and even then, do not pull in Radix UI, Headless UI, or any other component primitive library. The project uses `@base-ui/react` exclusively as the headless layer.

### Button

```tsx
import { Button } from "@/components/ui/button"
```

**Variants:**

| Variant | When to use |
|---|---|
| `default` | Primary actions (form submit, main CTA). Uses `bg-primary text-primary-foreground`. |
| `outline` | Secondary actions alongside a default button. |
| `secondary` | Mid-emphasis actions. Uses `bg-secondary`. |
| `ghost` | Low-emphasis actions, icon-only buttons in toolbars. |
| `destructive` | Delete / remove / irreversible actions. |
| `link` | Inline text links styled as buttons. |

**Sizes:**

| Size | Height | When to use |
|---|---|---|
| `xs` | 24px | Dense toolbars, badge-adjacent actions |
| `sm` | 28px | Compact cards, table row actions |
| `default` | 32px | Standard form controls and toolbars |
| `lg` | 36px | Call-to-action or prominent buttons |
| `icon` | 32×32px | Icon-only at default size |
| `icon-sm` | 28×28px | Icon-only at small size |
| `icon-xs` | 24×24px | Icon-only at extra-small size |
| `icon-lg` | 36×36px | Icon-only at large size |

```tsx
// Primary action
<Button>Submit Job</Button>

// With icon
<Button variant="ghost" size="icon">
  <Trash2 />
</Button>

// Destructive
<Button variant="destructive">Delete</Button>
```

### Badge

```tsx
import { Badge } from "@/components/ui/badge"
```

**Variants:** `default` (primary), `secondary`, `destructive`, `outline`, `ghost`, `link`

Use badges for: status labels (job status, version numbers), category tags, count indicators.

```tsx
<Badge variant="outline">v1.2.3</Badge>
<Badge variant="destructive">Failed</Badge>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"
```

Cards use `ring-1 ring-foreground/10` instead of a visible border. The `size="sm"` prop reduces padding.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Reads</CardTitle>
    <CardDescription>Paired-end FASTQ files</CardDescription>
    <CardAction><Button size="icon-sm" variant="ghost"><Plus /></Button></CardAction>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

`CardFooter` automatically gets a `bg-muted/50` background and a top border — use it for form controls inside a card (e.g., submit / reset buttons).

### Alert

```tsx
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
```

**Variants:** `default` (uses `bg-card`), `destructive`

Place an icon as the first child to activate the two-column grid layout:

```tsx
<Alert variant="destructive">
  <OctagonXIcon />
  <AlertTitle>Validation failed</AlertTitle>
  <AlertDescription>At least one paired library is required.</AlertDescription>
</Alert>
```

### Input

```tsx
import { Input } from "@/components/ui/input"
```

Height: 32px (`h-8`). Background: `bg-transparent` with `border-input`. On hover in service forms, use the `.service-card-input` CSS class which adds `bg-secondary/20` on hover and `bg-muted` on focus.

### Select

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
```

Trigger size `"default"` is 32px (`h-8`); `"sm"` is 28px (`h-7`). Use `.service-card-select-trigger` on `SelectTrigger` inside service form cards.

### Textarea

Use `.service-card-textarea` on `<Textarea>` inside service forms — this applies `bg-muted`, monospace font, min/max height, and wrapping rules appropriate for FASTA/sequence data.

### Checkbox

```tsx
import { Checkbox } from "@/components/ui/checkbox"
```

Always pair with a `<Label>` connected via `htmlFor`. Never use a bare checkbox without a label.

### Radio Group

```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
```

For horizontal options use `.service-radio-group` or `.service-radio-group-horizontal`. For grid layout use `.service-radio-group-grid`. Each item should use `.service-radio-group-item` with its `<label>`.

### Collapsible (Advanced Options)

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
```

Wrap in `.service-collapsible-container` and add `.service-collapsible-trigger` on the trigger. The CSS `[data-slot="collapsible-content"]` rule in `globals.css` handles the smooth height animation — do not add extra transition classes.

```tsx
<div className="service-collapsible-container">
  <Collapsible>
    <div className="service-collapsible-header">
      <CollapsibleTrigger className="service-collapsible-trigger">
        Advanced Options <ChevronDown className="size-4" />
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent>
      <div className="service-collapsible-content">
        {/* fields */}
      </div>
    </CollapsibleContent>
  </Collapsible>
</div>
```

### Tooltip

```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
```

`TooltipProvider` is already mounted globally in the root layout — do not add another one. Tooltip content renders with `bg-primary text-primary-foreground` styling (a local edit: upstream uses `text-background`, which is dark on the primary fill in dark themes).

For service form field tooltips, use `DialogInfoPopup` from `@/components/services/dialog-info-popup` instead of a plain tooltip (it provides a full dialog for longer explanations).

### Dialog / Alert Dialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
```

Use `AlertDialog` for destructive confirmations (delete, cancel job). Use `Dialog` for informational or input dialogs.

### Skeleton

```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Use during data fetching to reserve layout space. Always match the dimensions of the real content:

```tsx
<Skeleton className="h-8 w-24" />
```

In the navbar, loading auth state uses `bg-white/20` skeletons on the `bg-primary` surface.

### Spinner

```tsx
import { Spinner } from "@/components/ui/spinner"
```

Wraps `Loader2Icon` with `animate-spin`. Use for inline loading indicators (button loading state, async validation, etc.):

```tsx
{isLoading && <Spinner className="text-muted-foreground" />}
```

### Separator

```tsx
import { Separator } from "@/components/ui/separator"
```

Use to visually divide sections within a card or form. Renders as `bg-border`.

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
```

Use for switching between mutually exclusive views within the same page region. Do not use tabs for top-level page navigation.

### Navigation Menu

```tsx
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@/components/ui/navigation-menu"
```

Used exclusively in the top navbar. Do not use `NavigationMenu` for in-page navigation.

### Scroll Area

```tsx
import { ScrollArea } from "@/components/ui/scroll-area"
```

Use `ScrollArea` when a region must clip and scroll with a styled scrollbar. For themed scrollbars on plain `div` elements, add the `.scrollbar-themed` CSS class instead.

---

## Layout Patterns

### Standard Page Layout

Every page outside the workspace and jobs views uses this structure:

```tsx
<div className="flex min-h-screen flex-col">
  <Navbar />
  <main className="flex flex-1 flex-col">{children}</main>
  <Footer />
</div>
```

### Full-Height Layout (Workspace / Jobs)

Pages that need a viewport-filling layout (no scroll on the outer container):

```tsx
<div className="flex h-screen flex-col overflow-hidden">
  <Navbar />
  <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
</div>
```

### Service Page Layout

Service form pages use:

```tsx
<div className="service-container">   {/* max-w-6xl px-4 py-8 mx-auto */}
  <div className="service-header">
    <ServiceHeader title="..." description="..." />
  </div>
  <form>
    <div className="service-form-section">
      <Card>...</Card>
      <Card>...</Card>
    </div>
    <div className="service-form-controls">
      <Button variant="outline">Reset</Button>
      <Button type="submit">Submit</Button>
    </div>
  </form>
</div>
```

### Card Grid Layouts

Use these CSS classes for consistent card grid spacing:

| Class | Columns |
|---|---|
| `.card-grid-two` | 1 col → 2 col (sm) |
| `.card-grid-three` | 1 col → 2 col (sm) → 3 col (lg) |
| `.card-grid-four` | 1 col → 2 col (sm) → 4 col (lg) |

Wrap in `.card-container` (`container mx-auto my-12 w-[90%] max-w-7xl space-y-12 py-8`).

### Content Centering

| Context | Pattern |
|---|---|
| Narrow forms (auth, settings) | `mx-auto max-w-2xl px-4 py-8` |
| Service forms | `mx-auto max-w-6xl px-4 py-8` (`.service-container`) |
| Standard pages | `container mx-auto w-[90%] max-w-7xl` |
| Wide data pages | `mx-auto max-w-7xl px-4 py-10 md:px-6` |

---

## Forms

### Technology

All service forms use **TanStack Form** (`@tanstack/react-form`) with **zod** for schema validation. Do not use `react-hook-form` or uncontrolled forms.

### Field Anatomy

Every form field uses three components from `@/components/ui/tanstack-form`:

```tsx
import { FieldItem, FieldLabel, FieldErrors } from "@/components/ui/tanstack-form"
import { Label } from "@/components/ui/label"
```

```tsx
<form.Field name="outputFolder">
  {(field) => (
    <FieldItem>
      <FieldLabel field={field}>Output Folder</FieldLabel>
      <Input
        id={field.name}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      <FieldErrors field={field} />
    </FieldItem>
  )}
</form.Field>
```

- `FieldLabel` turns red (`text-destructive`) after the field is touched or a submission is attempted.
- `FieldErrors` shows the first error message only — do not render a custom error paragraph alongside it.

### Required Fields

Mark required fields with `RequiredFormCardTitle` (for card-level titles) or `RequiredFormLabel` / `RequiredFormLabelInfo` (for field labels):

```tsx
import { RequiredFormCardTitle, RequiredFormLabel, RequiredFormLabelInfo } from "@/components/forms/required-form-components"

// Card title
<CardHeader>
  <RequiredFormCardTitle>Select Reads</RequiredFormCardTitle>
</CardHeader>

// Field label
<RequiredFormLabel>Reference Genome</RequiredFormLabel>
```

The asterisk uses `text-red-500`. Do not add a legend or footnote — the asterisk is the sole convention.

### Submission Pattern

All service forms submit via `useServiceFormSubmission` → `submitServiceJob()` → `AppService.start_app2`. Do not make direct API calls from form page components. Submission errors are displayed via `toast.error()`.

### Collapsible Advanced Options

Advanced parameters that most users will not touch must be placed inside a `Collapsible` section labeled "Advanced Options" and collapsed by default:

```tsx
<Collapsible defaultOpen={false}>
  <CollapsibleTrigger className="service-collapsible-trigger">
    Advanced Options <ChevronDown className="size-4" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="service-collapsible-content">
      {/* advanced fields */}
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

## Feedback & State

### Toast Notifications

Toasts use `sonner`. The `Toaster` is configured in the root layout with:
- Position: `top-right`
- Duration: 3000ms
- Icons: lucide-react variants (pre-configured, do not override per-call)
- Styling: inherits `--popover` / `--popover-foreground` / `--border` CSS variables

```tsx
import { toast } from "sonner"

toast.success("Job submitted successfully.")
toast.error("Submission failed: " + error.message)
toast.info("Loading genome data…")
toast.warning("This feature is experimental.")
```

Never put emojis in toast messages. Keep messages concise (one sentence). For errors, include the original error message — do not replace it with a generic string.

### Loading States

| Pattern | When |
|---|---|
| `<Spinner />` inline | Button loading, async validation, small regions |
| `<Skeleton />` | Replacing layout-affecting content during initial fetch |
| `bg-white/20` Skeleton | On `bg-primary` surfaces (navbar auth area) |

### Error States

- Form field errors: `FieldErrors` component (shows below the field in `text-destructive text-sm`)
- Section-level errors: `<Alert variant="destructive">` with `OctagonXIcon`
- Toast: `toast.error()` for submission / async failures
- Empty states in tables: use the `.service-table-none` class (`bg-gray-50 p-4 text-center text-gray-500 italic`)

---

## CSS Utility Classes

These classes are defined in `src/app/globals.css`. Prefer them over duplicating the same Tailwind combos inline.

### Navigation

| Class | Purpose |
|---|---|
| `.mobile-nav-section-header` | Section label in mobile nav drawer |
| `.mobile-nav-divider-title` | Colored category header in mobile nav |
| `.mobile-nav-link` | Individual nav link in mobile drawer |
| `.sheet-content-section-mobile` | Sheet section container |

### Links

| Class | Purpose |
|---|---|
| `.link` | Inline `text-blue-600` hyperlink with scale-on-hover |
| `.news-link` | `text-blue-600 font-semibold` with scale/underline on hover |
| `.icon-link` | 32px icon button for footer social links (white on primary bg) |

### Cards

| Class | Purpose |
|---|---|
| `.card-base` | Base styles for hand-rolled content cards (not shadcn Card) |
| `.card-image` | Image container inside `.card-base` with hover scale |
| `.card-title` | `text-secondary` title with hover-to-accent transition |
| `.card-description` | `text-muted-foreground` description with `line-clamp-2` |
| `.card-label` | `text-sm font-medium` field label inside a card |
| `.card-container` | Page-level card grid wrapper |
| `.card-grid-two/three/four` | Grid layout presets |

### Service Forms

| Class | Purpose |
|---|---|
| `.service-container` | Page wrapper for all service form pages |
| `.service-header` | `mb-8` container for `ServiceHeader` component |
| `.service-header-title` | Flex row for `<h1>` + info popup + version badge |
| `.service-header-description` | `mb-4 flex flex-col gap-2` for description paragraph |
| `.service-form-section` | `space-y-6` — wraps all cards in a form |
| `.service-form-controls` | `mt-4 flex flex-row justify-end gap-4` — submit/reset row |
| `.service-card-content` | `h-full space-y-6` inside `CardContent` |
| `.service-card-content-grid` | `grid-cols-1 md:grid-cols-2 gap-4 px-2` |
| `.service-card-row` | `flex w-full flex-col gap-4 sm:flex-row` |
| `.service-card-label` | `mb-2 block text-sm font-medium` |
| `.service-card-sublabel` | `text-foreground/70 mb-2 block text-sm font-normal` |
| `.service-card-input` | Styled input with hover/focus transitions |
| `.service-card-textarea` | Mono font, min/max height, wrap rules |
| `.service-card-select-trigger` | `bg-muted` select with hover/focus transitions |
| `.service-card-tooltip-icon` | `h-4 w-4 text-muted-foreground` |
| `.service-collapsible-container` | `bg-card rounded-md border p-2` wrapper |
| `.service-collapsible-trigger` | `flex items-center gap-1 p-2 font-medium` |
| `.service-collapsible-content` | `w-full space-y-4 px-2 py-2` |
| `.service-table` | `bg-muted overflow-hidden rounded-md border` |
| `.service-table-none` | Empty state for service tables |
| `.service-radio-group` | `flex flex-col gap-4 sm:flex-row` |
| `.service-radio-group-horizontal` | `flex flex-row flex-wrap gap-4` |
| `.service-radio-group-grid` | `grid grid-cols-1 gap-4 md:grid-cols-2` |
| `.service-radio-group-item` | `flex items-center justify-start space-x-2` |

### Scrollbars

Add `.scrollbar-themed` to any scrollable container to get a styled scrollbar that adapts to light/dark themes (uses `--muted-foreground` at 25% opacity, thinned to `0.375rem`).

### Footer

| Class | Purpose |
|---|---|
| `.footer-header` | `font-bold text-white` section title with hover-to-accent |
| `.footer-link` | `text-white` link with hover-to-accent + underline |

### FAQ / Accordion

| Class | Purpose |
|---|---|
| `.section-content` | Two-column grid: 200px sidebar + 1fr content |
| `.section-content-header` | `text-2xl font-bold` |
| `.accordion-item` | `rounded-lg border` |
| `.accordion-trigger` | Full-width trigger with justify-between |
| `.accordion-content` | `text-muted-foreground px-4 pt-2 pb-4` |

### Citations

The citation page has its own class family (`.citation-*`, `.timeline-*`, `.impact-*`, `.author-*`). Refer to `globals.css` lines 615–748 when building citation-related components.

---

## Anti-Patterns

The following patterns are explicitly forbidden. CI does not catch all of them — enforce them in code review.

| Anti-pattern | Correct approach |
|---|---|
| Using emojis anywhere in the UI | Use `lucide-react` icons |
| Hard-coding colors (`text-gray-600`, `bg-blue-500`) | Use semantic tokens (`text-muted-foreground`, `bg-primary`) |
| Using `SCREAMING_SNAKE_CASE` for constants | Use `camelCase` |
| Adding `//eslint-disable` comments | Fix the underlying lint issue |
| Using a non-null assertion (`!`) in tests | Use `expect.objectContaining()` |
| Writing generic error messages (`"An error occurred"`) | Preserve the original error message; condense only if excessively long |
| Mocking `fetch` with `vi.mock()` in tests | Use MSW to intercept at the network level |
| Using `react-hook-form` or uncontrolled forms | Use `@tanstack/react-form` + zod |
| Importing from `radix-ui` directly | Use the `@base-ui/react` wrappers via shadcn components |
| Building a custom component when a shadcn/Base UI one exists | Check `https://ui.shadcn.com/docs/components/base` first; install via shadcn CLI |
| Using Radix UI, Headless UI, or another headless library | `@base-ui/react` is the only allowed headless primitive layer |
| Adding a `TooltipProvider` to a page | It is already in the root layout |
| Building a custom icon from raw SVG | Import from `lucide-react` |
| Using `style={{ color: '...' }}` for brand colors | Use Tailwind utilities with CSS variables |
| Adding Storybook stories | Not used in this project — use Playwright for visual regression |
| Committing without running `pnpm lint && pnpm typecheck && pnpm build && pnpm test` | Run the full check suite first |
