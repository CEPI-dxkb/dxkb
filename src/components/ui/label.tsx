"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edit: variants, a `leading` axis, and the has-aria-disabled base
// classes. Base UI renders radios and checkboxes as a <span> with
// aria-disabled rather than a disabled <input>, so the upstream
// `peer-disabled:` never matches them; `has-aria-disabled:` dims a label that
// wraps a disabled one.
const labelVariants = cva(
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 has-aria-disabled:cursor-not-allowed has-aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        // The label of a choice beside its checkbox, radio or switch.
        option: "font-normal",
        // A small muted label above a field.
        caption: "text-xs text-muted-foreground",
        // A label followed by its required-field marker.
        required: "gap-1",
      },
      leading: {
        none: "",
        // Re-applies text-sm, whose paired 20px line height then replaces
        // the base `leading-none` (14px): for labels that sit in a line of
        // body text.
        normal: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      leading: "none",
    },
  }
)

function Label({
  className,
  variant,
  leading,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants({ variant, leading }), className)}
      {...props}
    />
  )
}

export { Label }
