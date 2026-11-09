import { formatUserFacingErrorMessage } from "@/lib/utils";

/** The copy for an error whose message production redacted. */
export const serverFailureCopy =
  "A server request failed while loading this page. This is usually temporary, so try again in a moment.";

// What React prints in place of a redacted server message.
const redactedMessagePattern = /Minified React error|Server Components render/i;

/**
 * The message an error boundary may show. A server error reaches the client
 * with a `digest` and its message replaced ("Minified React error #441…"), so
 * it gets the fixed copy and the digest is shown as a reference; a client
 * error keeps its own message, condensed.
 */
export function routeErrorMessage(
  error: Error & { digest?: string },
  fallback: string,
): string {
  if (error.digest || redactedMessagePattern.test(error.message)) {
    return fallback;
  }
  return formatUserFacingErrorMessage(error, fallback);
}
