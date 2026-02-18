import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResultsOverviewProps {
  isLoading: boolean;
  searchResults: Record<string, any>;
  labelsByType: Record<string, string>;
}

const ResultsOverview = ({ isLoading, searchResults, labelsByType }: ResultsOverviewProps) => {
  const searchTypes = Object.keys(labelsByType);

  return (
    <Card className="mb-8 px-4 py-8">
      <CardHeader>
        <CardTitle className="">Search Results</CardTitle>
      </CardHeader>
      <CardContent className="">
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Loading results...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-primary">
            <div className="space-y-2 sm:border-r border-border sm:pr-8">
              {searchTypes.slice(0, 5).map((type) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-foreground">{labelsByType[type]}:</span>
                  <span className="text-secondary">
                    {searchResults[type]?.result?.response?.numFound || 0}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 sm:px-8">
              {searchTypes.slice(5, 10).map((type) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-foreground">{labelsByType[type]}:</span>
                  <span className="text-secondary">
                    {searchResults[type]?.result?.response?.numFound || 0}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 sm:border-l border-border sm:pl-8">
              {searchTypes.slice(10, 15).map((type) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-foreground">{labelsByType[type]}:</span>
                  <span className="text-secondary">
                    {searchResults[type]?.result?.response?.numFound || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ResultsOverview;