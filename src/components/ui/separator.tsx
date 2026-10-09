"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

// Local edit (keep when regenerating with `shadcn add --overwrite`): the
// orientation variants key on `data-[orientation=...]`. Base UI sets
// `data-orientation` and no `data-horizontal`/`data-vertical`, so upstream's
// `data-horizontal:h-px` never matched and every separator rendered 0px.
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
