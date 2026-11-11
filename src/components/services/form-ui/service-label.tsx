import type * as React from "react";

import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
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

/**
 * A field label with its info icon on one row; `mb-0!` beats
 * `.service-card-label`'s unlayered `mb-2`, which would stack on the field's
 * `gap-2`.
 */
export function ServiceInfoLabel({
  info,
  className,
  ...props
}: React.ComponentProps<typeof ServiceFieldLabel> & { info: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <ServiceFieldLabel className={cn("mb-0!", className)} {...props} />
      {info}
    </div>
  );
}
