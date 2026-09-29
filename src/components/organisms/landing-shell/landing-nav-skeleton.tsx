"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useUiPreference } from "@/lib/ui-preferences/provider";

/** Rail placeholder for loading.tsx, at the width the real rail will render. */
export function LandingNavSkeleton() {
  const [collapsed] = useUiPreference("viewNavCollapsed");
  return (
    <Skeleton
      className={
        collapsed
          ? "hidden h-112 w-14 shrink-0 rounded-lg lg:block"
          : "hidden h-112 w-56 shrink-0 rounded-lg lg:block"
      }
    />
  );
}
