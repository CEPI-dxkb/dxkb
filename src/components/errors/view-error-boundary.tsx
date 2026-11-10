"use client";

import { useEffect } from "react";

import { ErrorPanel } from "./error-panel";
import { RetryButton } from "./retry-button";
import { routeErrorMessage, serverFailureCopy } from "./route-error-message";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  // reset() alone re-renders the same failed server payload, so refresh first.
  retry: () => void;
}

interface ViewErrorBoundaryProps extends RouteErrorProps {
  title: string;
  description?: string;
  hideMessage?: boolean;
  backHref?: string;
  backLabel?: string;
}

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
