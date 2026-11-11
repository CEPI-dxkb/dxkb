import { cn } from "@/lib/utils";
import {
  viewLabel,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { placeGroups, placeIcons } from "./folder-picker-utils";

interface FolderPickerPlacesNavProps {
  place: PickerView;
  isUploading: boolean;
  onSelectPlace: (view: PickerView) => void;
}

export function FolderPickerPlacesNav({
  place,
  isUploading,
  onSelectPlace,
}: FolderPickerPlacesNavProps) {
  return (
    <nav
      aria-label="Places"
      inert={isUploading}
      className="scrollbar-themed flex shrink-0 gap-1 overflow-auto border-b bg-muted/50 p-2 md:w-48 md:flex-col md:gap-4 md:border-r md:border-b-0"
    >
      {placeGroups.map((group) => (
        <div key={group.label} className="flex shrink-0 gap-0.5 md:flex-col">
          <p className="hidden px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase md:block">
            {group.label}
          </p>
          {group.views.map((view) => {
            const Icon = placeIcons[view];
            const isActive = view === place;
            return (
              <button
                key={view}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  onSelectPlace(view);
                }}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full",
                  isActive
                    ? "bg-primary/10 font-medium text-primary dark:text-foreground"
                    : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    view === "favorites"
                      ? "text-highlight"
                      : isActive
                        ? "text-primary dark:text-foreground"
                        : "text-muted-foreground",
                  )}
                />
                <span className="truncate">{viewLabel(view)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
