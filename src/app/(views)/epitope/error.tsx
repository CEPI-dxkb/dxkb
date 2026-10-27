"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function EpitopeError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Epitope view could not be loaded"
      backHref="/epitope"
      backLabel="Browse epitopes"
    />
  );
}
