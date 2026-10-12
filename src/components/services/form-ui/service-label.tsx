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
 * A field label with its info or help icon: the two share a row, 4px apart on
 * a common midline, as `RequiredFormLabelInfo` does without the "*" marker.
 * The label is no longer a direct child of the field, so it would keep
 * `.service-card-label`'s `mb-2` on top of the field's `gap-2` (16px to the
 * input); `mb-0!` beats that unlayered rule. `className` and the rest of the
 * props go to the label.
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
