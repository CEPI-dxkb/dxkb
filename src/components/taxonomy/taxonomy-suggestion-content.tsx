import type { ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import type { TaxonomyItem } from "@/types";

interface TaxonomySuggestionContentProps {
  results: TaxonomyItem[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  renderPrimary: (item: TaxonomyItem) => ReactNode;
  renderSecondary?: (item: TaxonomyItem) => ReactNode;
  onSelect: (item: TaxonomyItem) => void;
}

export function TaxonomySuggestionContent({
  results,
  loading,
  error,
  emptyMessage,
  renderPrimary,
  renderSecondary,
  onSelect,
}: TaxonomySuggestionContentProps) {
  if (error) {
    return <div className="text-destructive p-4 text-sm">Error: {error}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Searching...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  return results.map((item) => (
    <button
      type="button"
      key={item.taxon_id}
      className="hover:bg-accent flex w-full cursor-pointer items-center justify-between p-2 text-left"
      onClick={() => {
        onSelect(item);
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {renderPrimary(item)}
        </span>
        {renderSecondary && (
          <span className="text-muted-foreground block truncate text-xs">
            {renderSecondary(item)}
          </span>
        )}
      </span>
    </button>
  ));
}
