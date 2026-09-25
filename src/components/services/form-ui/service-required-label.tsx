import type * as React from "react";

import { RequiredFormLabel } from "@/components/forms/required-form-components";
import { cn } from "@/lib/utils";

/** `RequiredFormLabel` with the service form label style. */
export function ServiceRequiredLabel({
  className,
  ...props
}: React.ComponentProps<typeof RequiredFormLabel>) {
  return (
    <RequiredFormLabel
      className={cn("service-card-label", className)}
      {...props}
    />
  );
}
