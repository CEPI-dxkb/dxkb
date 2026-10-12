import type * as React from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { cn } from "@/lib/utils";

/**
 * The header of a read-library input ("Paired Read Library", "SRA Run
 * Accession", ...): its label, a rule across the row, and the action that
 * moves the entered library into Selected Libraries (usually a
 * `ServiceLibraryAddButton`, passed as `children`). A string `title` renders
 * as a `ServiceLabel`, which the header centers on the row.
 */
export function ServiceLibraryHeader({
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { title?: React.ReactNode }) {
  return (
    <div className={cn("service-library-header", className)} {...props}>
      {typeof title === "string" ? <ServiceLabel>{title}</ServiceLabel> : title}
      <div aria-hidden="true" className="service-library-divider" />
      {children}
    </div>
  );
}

/**
 * The library header's add button. It reads "Add" beside its arrow, on the
 * primary tint the pickers' dropdown chips use, so it stays findable while it
 * waits (disabled) for the files to be chosen; the bare outline arrow it
 * replaces sank into the card. `pending` swaps the arrow for a spinner and
 * disables the button (an SRA accession being validated). Give it an
 * `aria-label` that names the library ("Add paired read library").
 */
export function ServiceLibraryAddButton({
  pending = false,
  disabled,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "children" | "variant" | "size" | "type"
> & {
  pending?: boolean;
}) {
  return (
    <Button
      variant="soft"
      disabled={disabled || pending}
      {...props}
      // After the spread: an add action never submits the form around it.
      type="button"
    >
      Add
      {pending ? (
        <Loader2 data-icon="inline-end" className="animate-spin" />
      ) : (
        <ChevronRight data-icon="inline-end" />
      )}
    </Button>
  );
}
