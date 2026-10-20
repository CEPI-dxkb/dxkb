import type { ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { LookupErrorAlert } from "@/components/services/lookup-error-alert";
import type { TaxonomyItem } from "@/types";

interface TaxonomySuggestionContentProps {
  results: TaxonomyItem[];
  loading: boolean;
  /** The failed search, with what failed ("Taxonomy search unavailable: …"). */
  error: string | null;
  /** Runs the failed search again. */
  onRetry?: () => void;
  emptyMessage: string;
  renderPrimary: (item: TaxonomyItem) => ReactNode;
  renderSecondary?: (item: TaxonomyItem) => ReactNode;
  onSelect: (item: TaxonomyItem) => void;
}

export function TaxonomySuggestionContent({
  results,
  loading,
  error,
  onRetry,
  emptyMessage,
  renderPrimary,
  renderSecondary,
  onSelect,
}: TaxonomySuggestionContentProps) {
  if (error) {
    return (
      <div className="p-2">
        <LookupErrorAlert message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Searching...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return results.map((item) => (
    <button
      type="button"
      key={item.taxon_id}
      className="flex w-full cursor-pointer items-center justify-between p-2 text-left hover:bg-accent"
      onClick={() => {
        onSelect(item);
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {renderPrimary(item)}
        </span>
        {renderSecondary && (
          <span className="block truncate text-xs text-muted-foreground">
            {renderSecondary(item)}
          </span>
        )}
      </span>
    </button>
  ));
}
