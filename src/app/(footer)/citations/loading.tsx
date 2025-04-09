export default function Loading() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div className="h-5 w-24 bg-muted rounded animate-pulse mb-4" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse mt-2" />
              </div>
            ))}
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6 space-y-4">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <div className="h-[200px] w-full bg-muted rounded animate-pulse" />
          </div>
        </div>

        <div className="space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

