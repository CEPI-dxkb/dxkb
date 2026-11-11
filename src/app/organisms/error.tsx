"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

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
