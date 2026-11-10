"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// Shows fixed copy, since a client-side failure message can carry request
// details.
export default function DomainsAndMotifsError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Domains and Motifs view could not be loaded"
      description="An unexpected error occurred while loading this view."
      hideMessage
      backHref="/domains-and-motifs"
      backLabel="Browse domains and motifs"
    />
  );
}
