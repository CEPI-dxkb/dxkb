import type * as React from "react";

import { RequiredFormLabel } from "@/components/forms/required-form-components";
import { cn } from "@/lib/utils";

/**
 * `service-card-label-required` restores the 4px gap before the "*" that
 * `service-card-label`'s `block` display removes.
 */
export function ServiceRequiredLabel({
  className,
  ...props
}: React.ComponentProps<typeof RequiredFormLabel>) {
  return (
    <RequiredFormLabel
      className={cn(
        "service-card-label service-card-label-required",
        className,
      )}
      {...props}
    />
  );
}
