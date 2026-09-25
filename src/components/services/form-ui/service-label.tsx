import type * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ServiceLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return <Label className={cn("service-card-label", className)} {...props} />;
}

export function ServiceSubLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label className={cn("service-card-sublabel", className)} {...props} />
  );
}
