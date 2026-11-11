import type * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The legacy `card-sublabel`/`card-input` classes in globals.css differ from
// the `service-card-*` ones, so they keep their own wrappers.

export function CardFieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return <Label className={cn("card-sublabel", className)} {...props} />;
}

export function CardFieldInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return <Input className={cn("card-input", className)} {...props} />;
}
