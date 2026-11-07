"use client";

import * as React from "react";
import type { AnyFieldApi } from "@tanstack/react-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { fieldErrorMessage } from "./field-error-message";

function FieldItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-item"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel({
  field,
  className,
  ...props
}: React.ComponentProps<typeof Label> & { field: AnyFieldApi }) {
  const hasError =
    field.state.meta.errors.length > 0 &&
    (field.state.meta.isTouched || field.form.state.submissionAttempts > 0);
  return (
    <Label
      data-slot="form-label"
      data-error={hasError}
      htmlFor={field.name as string}
      className={cn("data-[error=true]:text-destructive", className)}
      {...props}
    />
  );
}

function FieldErrors({
  field,
  className,
}: {
  field: AnyFieldApi;
  className?: string;
}) {
  const message = fieldErrorMessage(field);
  if (!message) return null;

  return (
    <p
      data-slot="form-message"
      className={cn("text-sm text-destructive", className)}
    >
      {message}
    </p>
  );
}

export { FieldItem, FieldLabel, FieldErrors };
