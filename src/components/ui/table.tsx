"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edits (keep when regenerating with `shadcn add --overwrite`):
// `disableScrollWrapper`, TableRow `selectionIndicator`, and the `size` /
// `variant` axes below. Variant classes merge after each part's base in the
// same `cn` call, so tailwind-merge resolves conflicts as the call-site
// classes they replace did.

const tableVariants = cva("w-full caption-bottom text-sm", {
  variants: {
    size: {
      default: "",
      // Dense data grids.
      xs: "text-xs",
    },
    variant: {
      default: "",
      // The muted surface of a table inside a bordered, rounded box; the box
      // draws the frame, so the table adds none of its own.
      well: "bg-muted",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "default",
  },
})

const tableHeaderVariants = cva("[&_tr]:border-b", {
  variants: {
    variant: {
      default: "",
      muted: "bg-muted",
      // Sticky header over scrolling rows. The rows repaint the surface too,
      // as the header markup this replaced did.
      "sticky-surface": "bg-background shadow-sm [&_tr]:bg-background",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

const tableRowVariants = cva(
  "border-b transition-colors hover:bg-muted/50 data-selection-indicator:border-l-2 data-selection-indicator:border-l-transparent data-[state=selected]:bg-muted data-selection-indicator:data-[state=selected]:border-l-primary",
  {
    variants: {
      variant: {
        default: "",
        // The header row of a muted TableHeader.
        "muted-header": "border-y bg-muted",
        // Primary-tinted selection for dense grids; set
        // `data-state="selected"` on the row. A hovered selected row shows
        // bg-muted/50 in light themes and keeps its tint in dark themes.
        tint: "hover:bg-muted data-[state=selected]:bg-primary/15 data-[state=selected]:hover:bg-muted/50 dark:data-[state=selected]:bg-primary/30",
        // Alternate (odd) rows of a striped table.
        striped: "bg-muted/20",
        // Rows that do not react to the pointer (a selected-items list,
        // where only the row's remove button has a hover state).
        static: "hover:bg-transparent",
        // `static`, with every second body row filled (BV-BRC's selected
        // genome tables). The even rows repeat their fill on hover so they
        // stay still too.
        "static-striped":
          "even:bg-muted/50 hover:bg-transparent even:hover:bg-muted/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Cell rules shared by TableHead and TableCell.
const tableDividerVariants = {
  // A rule on the trailing edge.
  divider: "border-r",
  // A stronger trailing rule.
  "divider-strong": "border-r border-foreground/20",
}

const tableHeadVariants = cva(
  "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground has-[[role=checkbox]]:pr-0",
  {
    variants: {
      variant: {
        default: "",
        ...tableDividerVariants,
        "divider-strong-muted": "border-r border-foreground/20 bg-muted",
        // An opaque head cell (sticky or dragged headers).
        surface: "bg-background",
      },
      size: {
        default: "",
        xs: "text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const tableCellVariants = cva(
  "p-2 align-middle whitespace-nowrap has-[[role=checkbox]]:pr-0",
  {
    variants: {
      variant: {
        default: "",
        ...tableDividerVariants,
        // A border on every edge (data grids).
        grid: "border",
        // The sticky checkbox column of a `grid` table whose rows use the
        // `tint` variant (and a `group` class): an opaque surface so scrolled
        // cells do not show through, and opaque equivalents of the row's
        // surface in each state: hover (bg-muted), selected (bg-primary/15,
        // /30 in dark themes) and selected + hover (bg-muted/50 in light
        // themes; dark themes keep the tint).
        "sticky-select":
          "border bg-background group-hover:bg-muted group-data-[state=selected]:bg-[color-mix(in_srgb,var(--color-primary)_15%,var(--color-background))] group-data-[state=selected]:group-hover:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--color-background))] dark:group-data-[state=selected]:bg-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-background))] dark:group-data-[state=selected]:group-hover:bg-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-background))]",
        // Identifiers and sequences.
        code: "font-mono text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TableProps
  extends React.ComponentProps<"table">,
    VariantProps<typeof tableVariants> {
  /** When true, render only the table (no scroll wrapper). Use when the parent is the scroll container (e.g. for sticky headers). */
  disableScrollWrapper?: boolean;
}

function Table({
  className,
  disableScrollWrapper,
  size,
  variant,
  ...props
}: TableProps) {
  const tableEl = (
    <table
      data-slot="table"
      className={cn(tableVariants({ size, variant }), className)}
      {...props}
    />
  );
  if (disableScrollWrapper) return tableEl;
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      {tableEl}
    </div>
  );
}

function TableHeader({
  className,
  variant,
  ...props
}: React.ComponentProps<"thead"> & VariantProps<typeof tableHeaderVariants>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(tableHeaderVariants({ variant }), className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({
  className,
  selectionIndicator = false,
  variant,
  ...props
}: React.ComponentProps<"tr"> &
  VariantProps<typeof tableRowVariants> & {
    /** When true, reserves a 2px left border that turns primary (with the `bg-muted` fill) when the row also has `data-state="selected"`. */
    selectionIndicator?: boolean;
  }) {
  return (
    <tr
      data-slot="table-row"
      data-selection-indicator={selectionIndicator || undefined}
      className={cn(tableRowVariants({ variant }), className)}
      {...props}
    />
  )
}

function TableHead({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"th"> & VariantProps<typeof tableHeadVariants>) {
  return (
    <th
      data-slot="table-head"
      className={cn(tableHeadVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function TableCell({
  className,
  variant,
  ...props
}: React.ComponentProps<"td"> & VariantProps<typeof tableCellVariants>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(tableCellVariants({ variant }), className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
