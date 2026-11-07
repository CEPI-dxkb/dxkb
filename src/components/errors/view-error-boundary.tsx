"use client";

import { useEffect } from "react";

import { ErrorPanel } from "./error-panel";
import { RetryButton } from "./retry-button";
import { routeErrorMessage, serverFailureCopy } from "./route-error-message";

/** The props Next 16 passes an `error.tsx` component. */
export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  // Refreshes the route and then resets. reset() alone re-renders the same
  // failed server payload, so a button wired to it could never recover.
  retry: () => void;
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
