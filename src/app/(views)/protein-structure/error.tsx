"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function ProteinStructureError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Protein structure view could not be loaded"
      backHref="/protein-structure"
      backLabel="Browse protein structures"
    />
  );
}
