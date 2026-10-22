"use client";

import { Component, Fragment, type ReactNode } from "react";
import { RetryButton } from "@/components/errors/retry-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface GenomeBrowserErrorBoundaryState {
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
  state: GenomeBrowserErrorBoundaryState = { error: undefined, attempt: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  private retry = () => {
    this.setState((state) => ({ error: undefined, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.error !== undefined) {
      return (
        <Alert variant="destructive">
          <AlertTitle>The Genome Browser could not start</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                this.state.error,
                "The Genome Browser failed to start.",
              )}
            </p>
            <RetryButton retry={this.retry} />
          </AlertDescription>
        </Alert>
      );
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
