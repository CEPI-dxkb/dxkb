import type * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The legacy `card-sublabel` and `card-input` classes in globals.css differ
// from `service-card-sublabel` and `service-card-input`, so they keep their
// own wrappers rather than folding into ServiceSubLabel and ServiceInput.

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
