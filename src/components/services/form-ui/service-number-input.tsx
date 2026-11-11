import type * as React from "react";

import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

// Kept apart from service-input.tsx, which ~40 service modules import: the ui
// NumberInput brings react-number-format, which only five forms need.
export function ServiceNumberInput({
  className,
  ...props
}: React.ComponentProps<typeof NumberInput>) {
  return (
    <NumberInput className={cn("service-card-input", className)} {...props} />
  );
}
