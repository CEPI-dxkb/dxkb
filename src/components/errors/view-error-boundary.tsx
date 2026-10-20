"use client";

import { useEffect } from "react";

import { formatUserFacingErrorMessage } from "@/lib/utils";

import { ErrorPanel } from "./error-panel";
import { RetryButton } from "./retry-button";

/** The props Next 16 passes an `error.tsx` component. */
export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  // Refreshes the route and then resets. reset() alone re-renders the same
  // failed server payload, so a button wired to it could never recover.
  retry: () => void;
}

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

interface ViewErrorBoundaryProps extends RouteErrorProps {
  title: string;
  /** Shown when the error's own message is not (see `routeErrorMessage`). */
  description?: string;
  /** Show only `description`, never the error's message. */
  hideMessage?: boolean;
  backHref?: string;
  backLabel?: string;
}

/**
 * The one `error.tsx` body for a route segment: a destructive alert with the
 * condensed cause, a Retry that refetches the route (with a pending state), and
 * a link back to the segment's list.
 */
export function ViewErrorBoundary({
  error,
  retry,
  title,
  description = serverFailureCopy,
  hideMessage = false,
  backHref,
  backLabel,
}: ViewErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4">
      <ErrorPanel
        title={title}
        message={hideMessage ? description : routeErrorMessage(error, description)}
        reference={error.digest}
        retry={<RetryButton retry={retry} />}
        backHref={backHref}
        backLabel={backLabel}
      />
    </div>
  );
}
