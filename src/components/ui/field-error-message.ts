import type { AnyFieldApi } from "@tanstack/react-form";

/**
 * The message `FieldErrors` shows for a field, or null while it shows none.
 * For a control that renders the error itself instead of beside it.
 */
export function fieldErrorMessage(field: AnyFieldApi): string | null {
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
