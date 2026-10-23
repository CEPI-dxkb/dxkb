"use client";

import { Component, Fragment, type ReactNode } from "react";
import { RetryButton } from "@/components/errors/retry-button";
import { routeErrorMessage } from "@/components/errors/view-error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatUserFacingErrorMessage } from "@/lib/utils";

const startFailureCopy = "The Genome Browser failed to start.";

/**
 * JBrowse's own messages are shown, but a React-internal failure inside its
 * tree reaches production as "Minified React error #…", which tells the user
 * nothing: `routeErrorMessage` swaps that for the fallback copy.
 */
function startFailureMessage(error: unknown): string {
  return error instanceof Error
    ? routeErrorMessage(error, startFailureCopy)
    : formatUserFacingErrorMessage(error, startFailureCopy);
}

interface GenomeBrowserErrorBoundaryState {
  /** Separate from `error`, since a child may throw `undefined` itself. */
  hasError: boolean;
  error: unknown;
  /** Bumped by Retry; keys the children so the engine is built afresh. */
  attempt: number;
}

/**
 * JBrowse 5's `useCreateViewState` rethrows a failed engine build from render
 * ("A build that throws rethrows from render, for an error boundary to
 * catch"). This keeps that failure inside the tab, with JBrowse's own message,
 * instead of letting the route's `error.tsx` replace the whole page.
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
