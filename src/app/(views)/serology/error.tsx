"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function SerologyError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Serology view could not be loaded"
      backHref="/serology"
      backLabel="Browse serology records"
    />
  );
}
