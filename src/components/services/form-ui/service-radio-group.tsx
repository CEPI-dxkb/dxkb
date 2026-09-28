import type * as React from "react";

import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** A radio group whose items wrap in a row. */
export function ServiceRadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup
      className={cn("service-radio-group-horizontal", className)}
      {...props}
    />
  );
}

/** A radio group laid out as a one-column grid, two columns from md up. */
export function ServiceRadioGroupGrid({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup
      className={cn("service-radio-group-grid", className)}
      {...props}
    />
  );
}
