"use client";

import { Component, Fragment, type ReactNode } from "react";
import { RetryButton } from "@/components/errors/retry-button";
import { routeErrorMessage } from "@/components/errors/route-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatUserFacingErrorMessage } from "@/lib/utils";

const startFailureCopy = "The Genome Browser failed to start.";

/**
 * `routeErrorMessage` swaps React's minified-error text for the fallback copy;
 * JBrowse's own messages are shown.
 */
function startFailureMessage(error: unknown): string {
  return error instanceof Error
    ? routeErrorMessage(error, startFailureCopy)
    : formatUserFacingErrorMessage(error, startFailureCopy);
}

interface GenomeBrowserErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  attempt: number;
}

/**
 * JBrowse 5's `useCreateViewState` rethrows a failed engine build from render;
 * this keeps it inside the tab.
 */
export class GenomeBrowserErrorBoundary extends Component<
  { children: ReactNode },
  GenomeBrowserErrorBoundaryState
> {
  state: GenomeBrowserErrorBoundaryState = {
    hasError: false,
    error: undefined,
    attempt: 0,
  };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  private retry = () => {
    this.setState((state) => ({
      hasError: false,
      error: undefined,
      attempt: state.attempt + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>The Genome Browser could not start</AlertTitle>
          <AlertDescription>
            <p>
              {startFailureMessage(this.state.error)}
            </p>
            <RetryButton retry={this.retry} />
          </AlertDescription>
        </Alert>
      );
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
