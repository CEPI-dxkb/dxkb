"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// This view fetches its data on the client, so an error that reaches the
// boundary is a client render failure whose message can carry request
// details; it shows fixed copy (and the digest, when there is one) instead.
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
