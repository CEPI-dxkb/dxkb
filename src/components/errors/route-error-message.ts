import { formatUserFacingErrorMessage } from "@/lib/utils";

export const serverFailureCopy =
  "A server request failed while loading this page. This is usually temporary, so try again in a moment.";

const redactedMessagePattern = /Minified React error|Server Components render/i;

/**
 * A server error arrives with a `digest` and a redacted message, so it gets
 * fixed copy; a client error keeps its own message.
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
