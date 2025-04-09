export default function Loading() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>

        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="flex space-x-2">
            <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
            <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        </div>

        <div className="space-y-12">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="relative">
                <div className="py-3">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="ml-4 h-6 w-16 bg-muted rounded animate-pulse" />
                    <div className="ml-2 h-5 w-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="mt-4 h-px w-full bg-muted" />
                </div>

                <div className="mt-6 space-y-6 pl-14">
                  {Array(2)
                    .fill(0)
                    .map((_, j) => (
                      <div key={j} className="relative">
                        <div className="absolute -left-9 mt-1 h-4 w-4 rounded-full border-2 border-muted bg-background"></div>
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
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
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

