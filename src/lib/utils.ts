export { cn } from "cn";

export const noop: () => void = () => undefined;

/**
 * Presentation cap for a user-facing error message. Upstream/auth/validation
 * failures can carry long diagnostic payloads; truncate rather than replace
 * them so the actionable part of the original message still reaches the user
 * (see repository guidance: never swap a real error for a generic one).
 */
export const maxUserFacingErrorMessageLength = 300;

/**
 * Turns a caught value into text that is safe to put in front of a user.
 *
 * Every presentation sink has to make the same three decisions, and each one
 * that made them alone got a different subset wrong:
 * - a non-`Error` rejection carries no message, so `String(error)` shows the
 *   user `"[object Object]"` or `"undefined"` instead of anything actionable;
 * - an `Error` whose message is empty or whitespace-only paints an alert with
 *   no text in it — announced to a screen reader as an empty alert — and an
 *   empty string is falsy, so it can even suppress a `{message && …}` guard;
 * - a very long message has to be condensed, not replaced.
 *
 * `fallback` stays per-sink: the wording is specific to what failed, and only
 * the three decisions above are shared.
 */
export function formatUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  if (message.length <= maxUserFacingErrorMessageLength) return message;
  return `${message.slice(0, maxUserFacingErrorMessageLength).trimEnd()}…`;
}

/**
 * Returns the first non-null/undefined value for the given keys on the object.
 */
export function getFirstDefined(
  obj: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Programmatically trigger a file download via a temporary anchor element.
 */
export function triggerDownload(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  else anchor.download = "";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
