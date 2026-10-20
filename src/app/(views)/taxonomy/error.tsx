"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function TaxonomyError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Taxonomy view could not be loaded"
      backHref="/taxonomy"
      backLabel="Browse taxa"
    />
  );
}
