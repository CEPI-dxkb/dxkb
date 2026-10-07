"use client";

import * as React from "react";
import type { AnyFieldApi } from "@tanstack/react-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

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

/**
 * The message `FieldErrors` shows for a field, or null while it shows none.
 * For a control that renders the error itself instead of beside it.
 */
function fieldErrorMessage(field: AnyFieldApi): string | null {
  const errors = field.state.meta.errors;
  if (!errors.length) return null;

  // Only show errors after user interaction or a form submission attempt
  if (!field.state.meta.isTouched && field.form.state.submissionAttempts === 0)
    return null;

  const firstError = errors[0] as string | { message?: string };
  const message =
    typeof firstError === "string"
      ? firstError
      : firstError.message ?? "";

  return message || null;
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

export { FieldItem, FieldLabel, FieldErrors, fieldErrorMessage };
