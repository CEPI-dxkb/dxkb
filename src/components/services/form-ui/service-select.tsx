import type * as React from "react";

import { SelectContent, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * A select trigger with the pickers' primary chevron chip. It fills its
 * column by default; the width is a utility (`w-full`), not part of
 * `.service-card-select-trigger`, so a call-site width such as `w-20` wins
 * through tailwind-merge, and `min-w-0` lets a long value line-clamp in a
 * narrow column instead of pushing the chip out of view.
 */
export function ServiceSelectTrigger({
  className,
  icon = "chip",
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      className={cn("service-card-select-trigger w-full min-w-0", className)}
      icon={icon}
      {...props}
    />
  );
}

export function ServiceSelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent
      className={cn("service-card-select-content", className)}
      {...props}
    />
  );
}
