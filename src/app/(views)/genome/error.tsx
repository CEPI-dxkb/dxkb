"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function GenomeError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Genome view could not be loaded"
      backHref="/genome"
      backLabel="Browse genomes"
    />
  );
}
