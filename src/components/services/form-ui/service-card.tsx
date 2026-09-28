import type * as React from "react";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ServiceCardHeader({
  className,
  ...props
}: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader className={cn("service-card-header", className)} {...props} />
  );
}

export function ServiceCardTitle({
  className,
  ...props
}: React.ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle className={cn("service-card-title", className)} {...props} />
  );
}

export function ServiceCardContent({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return (
    <CardContent className={cn("service-card-content", className)} {...props} />
  );
}

/** A card's helper line in the service forms' compact 12px size. */
export function ServiceCardDescription({
  className,
  ...props
}: React.ComponentProps<typeof CardDescription>) {
  return <CardDescription className={cn("text-xs", className)} {...props} />;
}
