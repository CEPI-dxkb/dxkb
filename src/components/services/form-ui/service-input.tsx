import type * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ServiceInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return <Input className={cn("service-card-input", className)} {...props} />;
}

export function ServiceTextarea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea className={cn("service-card-textarea", className)} {...props} />
  );
}
