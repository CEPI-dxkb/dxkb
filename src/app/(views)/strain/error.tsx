"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function StrainError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Strain view could not be loaded"
      backHref="/strain"
      backLabel="Browse strains"
    />
  );
}
