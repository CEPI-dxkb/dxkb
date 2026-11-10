import type * as React from "react";

import { SelectContent, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * `w-full` is a utility, not part of `.service-card-select-trigger`, so a
 * call-site width wins through tailwind-merge; `min-w-0` lets a long value
 * line-clamp.
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
