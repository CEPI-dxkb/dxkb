import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edit: the disabled look (`bg-disabled` fill, not-allowed cursor, no
// `disabled:pointer-events-none`) shared by every field.
const inputVariants = cva(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-disabled dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        emphasis:
          "border-primary bg-card px-2 text-card-foreground dark:bg-card",
        mono: "font-mono text-sm placeholder:font-sans",
        "segment-end":
          "rounded-l-none rounded-r-md border-0 bg-background text-foreground shadow-none focus-visible:ring-0",
        "segment-end-lg":
          "h-12 rounded-l-none rounded-r-md border-0 bg-background text-foreground shadow-none focus-visible:ring-0",
        invalid: "border-destructive",
        valid: "border-success focus-visible:ring-success/50",
      },
      inset: {
        none: "",
        start: "pl-10",
        end: "pr-10",
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

export { Input }
