import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-link underline-offset-4 hover:underline",
        // Icon actions that remove or discard (e.g. "Remove metadata field").
        "ghost-destructive":
          "text-destructive hover:bg-muted hover:text-destructive/90 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Ghost buttons on a bg-primary surface (the mobile navbar).
        "ghost-inverse":
          "text-primary-foreground hover:bg-white/15 hover:text-primary-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Call-to-action on marketing and help surfaces: brand secondary
        // fill with the theme's paired foreground (the violet light theme
        // has a near-white secondary).
        cta: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Outlined control on a dark or brand surface (the navbar job pill).
        // Open matches hover rather than flipping to a light fill, so the pill
        // keeps its white text and brand-bar icon tints. Any lighter than
        // white/20 drops the white text under 4.5:1 on the navbar blue.
        "inverse-outline":
          "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white dark:hover:bg-muted/50 dark:aria-expanded:bg-muted/50",
        // Inverted pill that floats over page content (the mobile views
        // trigger).
        floating:
          "border-background/10 bg-foreground text-background shadow-2xl hover:bg-foreground/90",
        // Page-number buttons in a pager. The current page is keyed on the
        // aria-current="page" the buttons already set.
        pager:
          "bg-background text-foreground aria-[current=page]:bg-primary/15 aria-[current=page]:font-bold",
        // Previous/next buttons in a pager.
        "pager-step":
          "border-border bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        // Outline button on an accent surface (the impersonation banner).
        "outline-accent":
          "border-accent-foreground/30 bg-transparent hover:bg-accent-foreground/10 hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        // Bordered ghost icon action over content (copy-to-clipboard on a
        // code block).
        "ghost-outline":
          "rounded-sm border-border text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Popover trigger styled as a form field; field-active marks a field
        // holding a value (the jobs date filter).
        field:
          "border-input bg-background font-normal hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "field-active":
          "border-primary bg-primary/5 font-normal text-primary hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        // Round ghost info triggers with an accent hover (service info
        // popups); ghost-accent-primary is the header one.
        "ghost-accent":
          "rounded-full hover:bg-accent hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-foreground",
        "ghost-accent-primary":
          "rounded-full text-primary hover:bg-accent hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-foreground",
        // Primary-tinted chip, solid in dark themes (the dropdown toggles in
        // the service-form pickers).
        soft: "bg-primary/15 text-primary transition-colors hover:bg-primary/25 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80",
        // Suggestions toggle in the taxonomy pickers: the default fill with a
        // muted chevron that turns foreground on hover.
        "picker-toggle":
          "bg-primary text-muted-foreground transition-colors hover:text-foreground [a]:hover:bg-primary/80",
        // A row in a dropdown menu (sign out in the user menu).
        "menu-item":
          "rounded-md border-none hover:bg-secondary/80 hover:text-foreground focus:bg-secondary/80 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Action inside a notice banner on a primary bar (the truncated
        // preview banner). The hover text follows the hover fill: accent in
        // light themes, a muted wash over the primary bar in dark ones.
        banner:
          "hover:bg-accent/90 hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-primary-foreground",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // Compact controls in filter and table toolbars.
        toolbar:
          "h-8 gap-1.5 rounded px-2 py-1 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Icon-over-label tiles in the action bars (jobs, workspace, search).
        tile: "h-15 flex-col gap-1 px-2.5 font-normal has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Collapsed-panel toggles in the jobs and workspace shells.
        "panel-toggle":
          "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-normal in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        // Icon-over-label toggle at the top of a side rail.
        rail: "h-auto gap-0 rounded-[min(var(--radius-md),12px)] px-1 py-2 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        // Section navigation. The current item (aria-current="page") is
        // semibold and an aria-disabled item is muted.
        nav: "h-8 gap-1.5 px-2 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-disabled:text-muted-foreground aria-[current=page]:font-semibold",
        xl: "h-12.5 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        pill: "h-8 gap-2 rounded-full px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        "pill-lg":
          "h-12 gap-2 rounded-full pr-3 pl-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        pager:
          "h-8 gap-1.5 px-2 py-0.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Text links that sit inline with surrounding content: no padding.
        inline: "h-8 gap-1.5 px-0",
        "menu-item":
          "h-auto gap-2 px-1.5 py-1 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        banner:
          "h-auto gap-1 rounded-[min(var(--radius-md),12px)] px-2 py-0.5 text-xs font-bold in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
