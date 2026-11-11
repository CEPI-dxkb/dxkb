import type { AnyFieldApi } from "@tanstack/react-form";

/** The message `FieldErrors` shows for a field, or null while it shows none. */
export function fieldErrorMessage(field: AnyFieldApi): string | null {
  const errors = field.state.meta.errors;
  if (!errors.length) return null;

  if (!field.state.meta.isTouched && field.form.state.submissionAttempts === 0)
    return null;

  const firstError = errors[0] as string | { message?: string };
  const message =
    typeof firstError === "string"
      ? firstError
      : firstError.message ?? "";

  return message || null;
}
