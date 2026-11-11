import type * as React from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { cn } from "@/lib/utils";

/**
 * Header of a read-library input: a label, a rule, and the add action passed as
 * `children`.
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
 * Add button on the primary tint so it stays findable while disabled; give it
 * an `aria-label` naming the library.
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
