import type * as React from "react";

import { SelectContent, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A select trigger with the pickers' primary chevron chip. */
export function ServiceSelectTrigger({
  className,
  icon = "chip",
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      className={cn("service-card-select-trigger", className)}
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
