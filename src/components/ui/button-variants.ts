import { cva } from "class-variance-authority";

// Local edit: no `disabled:pointer-events-none`, so a disabled button keeps the
// base layer's not-allowed cursor.
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // `primary-hover` replaces `primary/80`, which drops violet-light to
        // 3.03:1 over the card.
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-link underline-offset-4 hover:underline",
        "ghost-destructive":
          "text-destructive hover:bg-muted hover:text-destructive/90 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        "ghost-inverse":
          "text-primary-foreground hover:bg-white/15 hover:text-primary-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        cta: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        // Anything lighter than white/20 on hover or open drops the white text
        // under 4.5:1 on the navbar blue.
        "inverse-outline":
          "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white dark:hover:bg-muted/50 dark:aria-expanded:bg-muted/50",
        floating:
          "border-background/10 bg-foreground text-background shadow-2xl hover:bg-foreground/90",
        pager:
          "bg-background text-foreground aria-[current=page]:bg-primary/15 aria-[current=page]:font-bold",
        "pager-step":
          "border-border bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        "outline-accent":
          "border-accent-foreground/30 bg-transparent hover:bg-accent-foreground/10 hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "ghost-outline":
          "rounded-sm border-border text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        field:
          "border-input bg-background font-normal hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "field-active":
          "border-primary bg-primary/5 font-normal text-primary hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:text-foreground dark:hover:bg-input/50",
        "ghost-accent":
          "rounded-full hover:bg-accent hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-foreground",
        "ghost-accent-primary":
          "rounded-full text-primary hover:bg-accent hover:text-accent-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:text-link dark:hover:bg-muted/50 dark:hover:text-foreground",
        "ghost-secondary":
          "text-foreground/75 hover:bg-secondary/20 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-secondary/30",
        "ghost-row":
          "text-foreground/75 hover:bg-foreground/10 hover:text-foreground aria-expanded:bg-foreground/10 aria-expanded:text-foreground dark:hover:bg-foreground/15 dark:aria-expanded:bg-foreground/15",
        soft: "bg-primary/15 text-primary transition-colors hover:bg-primary/25 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80",
        stepper:
          "border-input bg-background text-muted-foreground hover:bg-primary/15 hover:text-primary active:bg-primary/25 enabled:cursor-pointer dark:bg-input/30 dark:hover:bg-primary/40 dark:hover:text-foreground dark:active:bg-primary/55",
        "menu-item":
          "rounded-md border-none hover:bg-secondary-hover hover:text-secondary-foreground focus:bg-secondary-hover focus:text-secondary-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-foreground",
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
        "icon-2xs":
          "size-5 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        toolbar:
          "h-8 gap-1.5 rounded px-2 py-1 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Folds to a square icon button below @3xl; the label goes in `<span
        // data-label>`, which turns `sr-only` so it stays the accessible name.
        foldable:
          "size-8 gap-1.5 *:data-label:sr-only @3xl:w-auto @3xl:px-2.5 @3xl:has-data-[icon=inline-start]:pl-2 @3xl:*:data-label:not-sr-only",
        tile: "h-15 flex-col gap-1 px-2.5 font-normal has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        "panel-toggle":
          "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-normal in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        rail: "h-auto gap-0 rounded-[min(var(--radius-md),12px)] px-1 py-2 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        nav: "h-8 gap-1.5 px-2 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-disabled:text-muted-foreground aria-[current=page]:font-semibold",
        xl: "h-12.5 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        pill: "h-8 gap-2 rounded-full px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        "pill-lg":
          "h-12 gap-2 rounded-full pr-3 pl-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        pager:
          "h-8 gap-1.5 px-2 py-0.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        inline: "h-8 gap-1.5 px-0",
        text: "h-auto gap-1 rounded-sm p-0 align-baseline font-[inherit] text-[length:inherit]",
        "menu-item":
          "h-auto gap-2 px-1.5 py-1 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        banner:
          "h-auto gap-1 rounded-[min(var(--radius-md),12px)] px-2 py-0.5 text-xs font-bold in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "option-sm": "h-8 w-full gap-2 rounded-md px-2 text-left font-normal",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
