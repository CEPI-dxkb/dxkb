import type * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Base UI also accepts a `(state) => string` className on these parts, which
// `cn` cannot merge, so the wrappers take a string only.
type StringClassName<T> = Omit<T, "className"> & { className?: string };

export function ServiceCollapsible({
  className,
  ...props
}: StringClassName<React.ComponentProps<typeof Collapsible>>) {
  return (
    <Collapsible
      className={cn("service-collapsible-container", className)}
      {...props}
    />
  );
}

export function ServiceCollapsibleTrigger({
  className,
  ...props
}: StringClassName<React.ComponentProps<typeof CollapsibleTrigger>>) {
  return (
    <CollapsibleTrigger
      className={cn("service-collapsible-trigger", className)}
      {...props}
    />
  );
}

export function ServiceCollapsibleContent({
  className,
  ...props
}: StringClassName<React.ComponentProps<typeof CollapsibleContent>>) {
  return (
    <CollapsibleContent
      className={cn("service-collapsible-content", className)}
      {...props}
    />
  );
}
