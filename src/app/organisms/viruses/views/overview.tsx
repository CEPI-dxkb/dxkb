import { Suspense } from "react";
import { OverviewSkeleton } from "@/components/skeletons/viruses/overview-skeleton";

export function OverviewView() {
  return (
    <div>
      <Suspense fallback={<OverviewSkeleton />}>
        <h2 className="text-2xl font-semibold mb-4">Overview View!</h2>
      </Suspense>
    </div>
  );
}

export default OverviewView;