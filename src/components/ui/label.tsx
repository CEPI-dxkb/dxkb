"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Base UI renders radios and checkboxes as <span aria-disabled>, so upstream's
// `peer-disabled:` never matches; `has-aria-disabled:` and
// `peer-data-disabled:` cover them.
const labelVariants = cva(
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-disabled:cursor-not-allowed has-aria-disabled:cursor-not-allowed has-aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        option: "font-normal",
        caption: "text-xs text-muted-foreground",
        required: "gap-1",
      },
      leading: {
        none: "",
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
