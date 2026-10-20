"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function ExperimentError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Experiment view could not be loaded"
      backHref="/experiment"
      backLabel="Browse experiments"
    />
  );
}
