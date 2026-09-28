import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edits (keep when regenerating with `shadcn add --overwrite`): the
// `variant` and `inset` axes. Their classes are merged after the base, in the
// same `cn` call, so tailwind-merge resolves conflicts exactly as the call-site
// classes they replace did.
const inputVariants = cva(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        // Card-surface field with a primary outline (filter-bar keyword search).
        emphasis:
          "border-primary bg-card px-2 text-card-foreground dark:bg-card",
        // Paths, ids and sequences.
        mono: "font-mono text-sm",
        // Trailing part of a joined control whose wrapper draws the outline
        // (search bar: type select + query input). `-lg` is the tall form.
        "segment-end":
          "rounded-l-none rounded-r-md border-0 bg-background text-foreground shadow-none focus-visible:ring-0",
        "segment-end-lg":
          "rounded-l-none rounded-r-md border-0 bg-background py-6 text-foreground shadow-none focus-visible:ring-0",
        // Error border without the `aria-invalid` focus ring, for the service
        // pickers that must keep their border-only error look.
        invalid: "border-destructive",
      },
      // Horizontal padding that leaves room for icons laid over the field
      // (service-form pickers): a leading search icon (`start`), a leading
      // icon and a trailing toggle (`both`), or a wider trailing chip
      // (`start-end`). `aligned` has no icons but starts the text where the
      // icon column of a sibling picker sits.
      inset: {
        none: "",
        start: "pl-10",
        both: "px-10",
        "start-end": "pr-12 pl-10",
        aligned: "pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      inset: "none",
    },
  }
)

function Input({
  className,
  type,
  variant,
  inset,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, inset }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
