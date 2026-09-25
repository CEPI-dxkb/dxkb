import type * as React from "react";

import { FieldItem, FieldLabel } from "@/components/ui/tanstack-form";
import { cn } from "@/lib/utils";

export function ServiceFieldItem({
  className,
  ...props
}: React.ComponentProps<typeof FieldItem>) {
  return (
    <FieldItem className={cn("service-card-row-item", className)} {...props} />
  );
}

export function ServiceFieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof FieldLabel>) {
  return (
    <FieldLabel className={cn("service-card-label", className)} {...props} />
  );
}

export function ServiceFieldSubLabel({
  className,
  ...props
}: React.ComponentProps<typeof FieldLabel>) {
  return (
    <FieldLabel
      className={cn("service-card-sublabel", className)}
      {...props}
    />
  );
}
