import type * as React from "react";
import { Plus, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Icon-only add button on the same `soft` tint as `ServiceLibraryAddButton`;
 * give it an `aria-label` naming what it adds.
 */
export function ServiceAddButton({
  icon: Icon = Plus,
  pending = false,
  disabled,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "children" | "variant" | "size" | "type"
> & {
  icon?: LucideIcon;
  pending?: boolean;
}) {
  return (
    <Button
      variant="soft"
      size="icon"
      disabled={disabled || pending}
      {...props}
      // After the spread: an add action never submits the form around it.
      type="button"
    >
      {pending ? <Spinner /> : <Icon />}
    </Button>
  );
}
