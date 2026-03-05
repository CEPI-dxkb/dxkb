"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsBrowser } from "@/components/jobs/jobs-browser";

function JobsPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex-1 px-4">
        <div className="rounded-md border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b px-6 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<JobsPageSkeleton />}>
        <JobsBrowser />
      </Suspense>
    </div>
  );
}
