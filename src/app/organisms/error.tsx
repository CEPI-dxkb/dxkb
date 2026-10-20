"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// The last resort: the landing pages fall back to static root taxonomy and
// their data sections fail one by one, so an outage alone no longer reaches
// this boundary.
export default function OrganismsError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Organism data is temporarily unavailable"
      description="We could not load the organism data for this page. This is usually temporary, so try again in a moment."
      backHref="/"
      backLabel="Go to the home page"
    />
  );
}
