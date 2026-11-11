export { cn } from "cn";

export const noop: () => void = () => undefined;

/** Truncation cap for user-facing error messages; long payloads are condensed, never replaced. */
export const maxUserFacingErrorMessageLength = 300;

/** Turns a caught value into user-safe text: non-`Error` rejections and empty messages use `fallback`, and long messages are condensed. */
export function formatUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  if (message.length <= maxUserFacingErrorMessageLength) return message;
  return `${message.slice(0, maxUserFacingErrorMessageLength).trimEnd()}…`;
}

/** `formatUserFacingErrorMessage` behind a prefix naming the failed action; a message already starting with the prefix is not repeated. */
export function formatPrefixedErrorMessage(
  prefix: string,
  error: unknown,
): string {
  const reason = formatUserFacingErrorMessage(error, "");
  if (!reason) return `${prefix}.`;
  if (reason.toLowerCase().startsWith(prefix.toLowerCase())) return reason;
  return `${prefix}: ${reason}`;
}

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

/** The object URL is released on the next task because WebKit can still be resolving it when `click()` returns. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
