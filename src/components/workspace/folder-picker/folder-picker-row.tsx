import type { KeyboardEvent } from "react";
import { ChevronRight, Lock } from "lucide-react";
import {
  WorkspaceItemIcon,
  type FolderIconVariant,
} from "@/components/workspace/workspace-item-icon";
import { formatFileSize, formatOwner } from "@/lib/services/workspace/helpers";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import {
  isPickerItemInteractive,
  isPickerItemNavigable,
  pickerRowKey,
  type PickerTarget,
} from "@/lib/services/workspace/picker-views";
import { cn } from "@/lib/utils";

interface FolderPickerRowProps {
  item: WorkspaceItem;
  target: PickerTarget;
  /** The column holding the row. */
  index: number;
  folderVariant: FolderIconVariant;
  showOwner: boolean;
  /** The row is its column's selection. */
  isSelected: boolean;
  /** The row is the picker's selection (active styling). */
  isActive: boolean;
  /** The row is the strip's single Tab stop. */
  isTabStop: boolean;
  isWritable: boolean;
  isUsable: boolean;
  onSelect: () => void;
  onCommit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** One option row of a column: icon, name, owner, size, lock and chevron. */
export function FolderPickerRow({
  item,
  target,
  index,
  folderVariant,
  showOwner,
  isSelected,
  isActive,
  isTabStop,
  isWritable,
  isUsable,
  onSelect,
  onCommit,
  onKeyDown,
}: FolderPickerRowProps) {
  const key = pickerRowKey(item, target);
  const navigable = isPickerItemNavigable(item, target);
  const interactive = isPickerItemInteractive(item, target);
  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={interactive ? undefined : true}
      tabIndex={interactive ? (isTabStop ? 0 : -1) : undefined}
      data-picker-row=""
      data-picker-col={index}
      data-picker-path={key}
      title={item.path}
      onClick={interactive ? onSelect : undefined}
      onDoubleClick={interactive ? onCommit : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        !interactive && "text-muted-foreground",
        interactive && !isSelected && "hover:bg-muted/70",
        interactive && !isSelected && !isUsable && "text-muted-foreground",
        isActive && "bg-primary text-primary-foreground",
        isSelected && !isActive && "bg-muted text-foreground",
      )}
    >
      <WorkspaceItemIcon
        type={item.type}
        variant={folderVariant}
        className={isActive ? "text-primary-foreground" : undefined}
      />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {showOwner ? (
        <span
          className={cn(
            "max-w-20 shrink-0 truncate text-2xs",
            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {formatOwner(item.ownerId ?? "")}
        </span>
      ) : null}
      {!navigable && item.size > 0 ? (
        <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
          {formatFileSize(item.size)}
        </span>
      ) : null}
      {target.kind === "folder" && navigable && !isWritable ? (
        <>
          <Lock
            aria-hidden
            className={cn(
              "size-3 shrink-0",
              isActive ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          />
          <span className="sr-only">(read-only)</span>
        </>
      ) : null}
      {navigable ? (
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        />
      ) : null}
    </div>
  );
}
