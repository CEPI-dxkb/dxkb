import type * as React from "react";
import { Plus, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * The icon-only add button beside a picker (add a genome, a genome group, a
 * pipeline action, ...). It sits on the same `soft` primary tint as
 * `ServiceLibraryAddButton`, so every add action in a service form shares one
 * look in every state. `icon` swaps the "+" for another glyph (the arrow that
 * moves a metadata field into its table). `pending` swaps the icon for a
 * spinner and disables the button (a group's members being fetched). Give it
 * an `aria-label` that names what it adds ("Add genome group").
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
