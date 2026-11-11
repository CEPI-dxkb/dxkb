"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const tableVariants = cva("w-full caption-bottom text-sm", {
  variants: {
    size: {
      default: "",
      xs: "text-xs",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

const tableHeaderVariants = cva("[&_tr]:border-b", {
  variants: {
    variant: {
      default: "",
      muted: "bg-muted",
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
        "muted-header": "border-y bg-muted",
        tint: "hover:bg-muted data-[state=selected]:bg-primary/15 data-[state=selected]:hover:bg-muted/50 dark:data-[state=selected]:bg-primary/30",
        striped: "bg-muted/20",
        static: "hover:bg-transparent",
        "static-striped":
          "even:bg-muted/50 hover:bg-transparent even:hover:bg-muted/50",
        // Only the body's last child drops its rule, and a rule shared with a
        // `visibility: collapse` row is half painted, so what follows the table
        // draws the line.
        "last-shown": "border-b-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const tableDividerVariants = {
  divider: "border-r",
  "divider-strong": "border-r border-foreground/20",
}

const tableHeadVariants = cva(
  "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground has-[[role=checkbox]]:pr-0",
  {
    variants: {
      variant: {
        default: "",
        ...tableDividerVariants,
        // `info`, not `primary`: dark themes keep a dark primary that the tint
        // would swallow.
        "divider-strong-muted":
          "border-r border-foreground/20 bg-muted aria-[sort=ascending]:bg-info/15 aria-[sort=ascending]:shadow-[inset_0_-2px_0_var(--color-info)] aria-[sort=descending]:bg-info/15 aria-[sort=descending]:shadow-[inset_0_-2px_0_var(--color-info)]",
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
        grid: "border",
        "sticky-select":
          "border bg-background group-hover:bg-muted group-data-[state=selected]:bg-[color-mix(in_srgb,var(--color-primary)_15%,var(--color-background))] group-data-[state=selected]:group-hover:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--color-background))] dark:group-data-[state=selected]:bg-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-background))] dark:group-data-[state=selected]:group-hover:bg-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-background))]",
        code: "font-mono text-xs",
        wrap: "break-all whitespace-normal",
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
  /** Render only the table, for when the parent is the scroll container. */
  disableScrollWrapper?: boolean;
}

function Table({
  className,
  disableScrollWrapper,
  size,
  ...props
}: TableProps) {
  const tableEl = (
    <table
      data-slot="table"
      className={cn(tableVariants({ size }), className)}
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
      className={cn(
        "transition-opacity aria-busy:opacity-50 [&_tr:last-child]:border-0",
        className,
      )}
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
    /** Reserves a 2px left border that turns primary on a selected row. */
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
