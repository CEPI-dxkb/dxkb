import type { RefObject } from "react";
import { Loader2, ShieldUser } from "lucide-react";

import type { GenomeSummary } from "@/lib/services/genome";
import { cn } from "@/lib/utils";

interface GenomeSuggestionListProps {
  suggestions: GenomeSummary[];
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  highlightedIndex: number;
  itemRefs: RefObject<(HTMLButtonElement | null)[]>;
  onSelect: (genome: GenomeSummary) => void;
  onHighlight: (index: number) => void;
  isDisabled?: (genome: GenomeSummary) => boolean;
  showPrivateIndicator?: boolean;
  itemClassName?: string;
}

export function GenomeSuggestionList({
  suggestions,
  isLoading,
  error,
  emptyMessage,
  highlightedIndex,
  itemRefs,
  onSelect,
  onHighlight,
  isDisabled = () => false,
  showPrivateIndicator = false,
  itemClassName,
}: GenomeSuggestionListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="mr-2 size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Searching...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive p-4 text-sm">{error}</div>;
  }

  if (suggestions.length === 0) {
    return emptyMessage ? (
      <p className="text-muted-foreground py-4 text-center text-sm">
        {emptyMessage}
      </p>
    ) : null;
  }

  return suggestions.map((genome, index) => {
    const disabled = isDisabled(genome);
    return (
      <button
        key={genome.genome_id}
        ref={(element) => {
          itemRefs.current[index] = element;
        }}
        type="button"
        className={cn(
          "hover:bg-accent flex w-full flex-col items-start gap-1 px-4 py-2 text-left",
          // Caller overrides come before the state classes so a caller-supplied
          // background (e.g. `bg-transparent`) cannot strip the keyboard
          // highlight via tailwind-merge's last-wins resolution.
          itemClassName,
          disabled && "cursor-not-allowed opacity-60",
          highlightedIndex === index && "bg-accent",
        )}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onSelect(genome);
        }}
        onMouseEnter={() => {
          onHighlight(index);
        }}
      >
        <span className="flex items-center gap-1 truncate text-sm font-medium">
          {showPrivateIndicator && genome.public === false && (
            <ShieldUser className="text-foreground/90 size-3.5 shrink-0" />
          )}
          <span className="truncate">{genome.genome_name}</span>
        </span>
        <span className="text-muted-foreground text-xs">
          {genome.genome_id}
          {genome.strain ? ` • ${genome.strain}` : ""}
        </span>
      </button>
    );
  });
}
