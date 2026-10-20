"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function SurveillanceError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Surveillance view could not be loaded"
      backHref="/surveillance"
      backLabel="Browse surveillance records"
    />
  );
}
