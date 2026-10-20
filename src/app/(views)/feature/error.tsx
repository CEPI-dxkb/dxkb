"use client";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

export default function FeatureError(props: RouteErrorProps) {
  return (
    <ViewErrorBoundary
      {...props}
      title="Feature view could not be loaded"
      backHref="/feature"
      backLabel="Browse features"
    />
  );
}
