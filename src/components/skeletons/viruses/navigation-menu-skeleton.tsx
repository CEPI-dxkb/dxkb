import { Skeleton } from "@/components/ui/skeleton";

export function NavigationMenuSkeleton() {
  return (
    <div data-testid="navigation-menu-skeleton">
      <Skeleton className="h-8 w-[250px] mb-4" />
      <div className="grid gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

export default NavigationMenuSkeleton;