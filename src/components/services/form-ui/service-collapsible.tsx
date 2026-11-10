import type * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Base UI also accepts a `(state) => string` className, which `cn` cannot
// merge, so the wrappers take a string only.
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

/**
 * Padding sits on an inner div so the open/close height animation runs to 0
 * instead of stopping at the padding.
 */
export function ServiceCollapsibleContent({
  className,
  children,
  ...props
}: StringClassName<React.ComponentProps<typeof CollapsibleContent>>) {
  return (
    <CollapsibleContent {...props}>
      <div className={cn("service-collapsible-content", className)}>
        {children}
      </div>
    </CollapsibleContent>
  );
}
