import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edits (keep when regenerating with `shadcn add --overwrite`): the disabled look
// shared by every field: the `bg-disabled` fill and muted text at full
// opacity, with the not-allowed cursor (no `disabled:pointer-events-none`).
// And the `variant` axis, merged after the base in the same `cn` call.
const textareaVariants = cva(
  "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-disabled dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        // Sequence entry (FASTA and similar).
        mono: "font-mono text-sm",
        "mono-xs": "font-mono text-xs",
        // Success border for content that passed validation (the FASTA
        // sequence box). The error state stays on `aria-invalid`.
        valid: "border-success focus-visible:ring-success/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Textarea({
  className,
  variant,
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
