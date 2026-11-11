import type * as React from "react";

import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

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
