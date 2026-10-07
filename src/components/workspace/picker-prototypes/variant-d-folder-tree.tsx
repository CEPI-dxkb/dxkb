"use client";

/**
 * PROTOTYPE — variant D, the tree half: one `role="tree"` holding three
 * collapsible sections (My Workspaces, Shared with me, Public), each a lazily
 * loaded folder tree. Children load when a node expands (a child component
 * mounts only while it is open, so the listing hook stays unconditional).
 * Keyboard: roving tabindex, ↑/↓ move, → expand / first child, ← collapse /
 * parent, Home/End, Enter commits. State lives in `variant-d-sheet-tree.tsx`.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe,
  HardDrive,
  House,
  Lock,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspacePickerListing } from "@/hooks/services/workspace/use-workspace-picker-listing";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import {
  buildPickerItems,
  canWriteTo,
  emptyListingMessage,
  filterListing,
  folderNameError,
  pickerCommitState,
  pickerHomePath,
  type PickerListView,
  type PickerSelectablePredicate,
  type PickerTarget,
} from "@/lib/services/workspace/picker-views";
import { cn } from "@/lib/utils";

export const folderTarget: PickerTarget = { kind: "folder" };

export type TreeSectionId = "mine" | "shared" | "public";

/**
 * Node keys are `<section>:<path>` because one workspace can appear in two
 * sections (an own public workspace is under My Workspaces and Public).
 * A section's own key is `<section>:`.
 */
export function sectionKey(section: TreeSectionId): string {
  return `${section}:`;
}

export function nodeKey(section: TreeSectionId, path: string): string {
  return `${section}:${normalizePath(path)}`;
}

export function isDescendantKey(key: string, ancestor: string): boolean {
  if (key === ancestor) return false;
  return ancestor.endsWith(":")
    ? key.startsWith(ancestor)
    : key.startsWith(`${ancestor}/`);
}

/** A node as the sheet sees it: where it is, and its permission evidence. */
export interface TreeNodeTarget {
  key: string;
  path: string;
  /** The node's own item, or the nearest ancestor's that has permissions. */
  item: WorkspaceItem | null;
}

export interface FolderTreeState {
  username: string;
  isSelectable: PickerSelectablePredicate;
  expanded: ReadonlySet<string>;
  selectedKey: string | null;
  /** The roving tab stop; `null` falls back to the My Workspaces header. */
  focusKey: string | null;
  /** Scroll this node into view when it renders (and focus it if asked). */
  reveal: { key: string; focus: boolean } | null;
  /** Node whose first child is the inline new-folder row. */
  creatingKey: string | null;
  isCreating: boolean;
  isUploading: boolean;
  onToggle: (key: string) => void;
  onFocusNode: (key: string, node: TreeNodeTarget | null) => void;
  onCommit: (path: string) => void;
  onStartCreate: (node: TreeNodeTarget) => void;
  onCancelCreate: () => void;
  /** Rejects with the backend's error, which the inline row shows as-is. */
  onCreate: (input: {
    parentKey: string;
    section: TreeSectionId;
    parentPath: string;
    name: string;
  }) => Promise<void>;
  onStartUpload: (node: TreeNodeTarget) => void;
}

const FolderTreeContext = createContext<FolderTreeState | null>(null);

function useFolderTree(): FolderTreeState {
  const state = useContext(FolderTreeContext);
  if (!state) throw new Error("useFolderTree must be used inside FolderTree");
  return state;
}

const sectionMeta: Record<
  TreeSectionId,
  { label: string; view: PickerListView; icon: LucideIcon }
> = {
  mine: { label: "My Workspaces", view: "myWorkspaces", icon: HardDrive },
  shared: { label: "Shared with me", view: "shared", icon: Users },
  public: { label: "Public", view: "public", icon: Globe },
};

const sectionOrder: readonly TreeSectionId[] = ["mine", "shared", "public"];

function ownerLabel(path: string): string {
  const owner = normalizePath(path).split("/").filter(Boolean)[0] ?? "";
  return owner.replace(/@.*$/, "");
}

function treeItemSelector(key: string): string {
  return `[role="treeitem"][data-key="${CSS.escape(key)}"]`;
}

/** Arrow-key movement over the rendered (so visible) rows, in DOM order. */
function handleTreeKeyDown(
  event: KeyboardEvent<HTMLElement>,
  {
    key,
    parentKey,
    expanded,
    onToggle,
    onActivate,
    onSpace,
  }: {
    key: string;
    parentKey: string | null;
    expanded: boolean;
    onToggle: () => void;
    onActivate: () => void;
    onSpace?: () => void;
  },
) {
  // Keys pressed on the inline action buttons are theirs.
  if (event.target !== event.currentTarget) return;
  const row = event.currentTarget;
  const tree = row.closest('[role="tree"]');
  if (!tree) return;
  const rows = Array.from(
    tree.querySelectorAll<HTMLElement>('[role="treeitem"]'),
  );
  const index = rows.indexOf(row);
  const focusAt = (next: number) => {
    if (next >= 0 && next < rows.length) rows[next].focus();
  };

  switch (event.key) {
    case "ArrowDown":
      focusAt(index + 1);
      break;
    case "ArrowUp":
      focusAt(index - 1);
      break;
    case "Home":
      focusAt(0);
      break;
    case "End":
      focusAt(rows.length - 1);
      break;
    case "ArrowRight":
      if (!expanded) onToggle();
      else if (
        index + 1 < rows.length &&
        rows[index + 1].dataset.parentKey === key
      ) {
        focusAt(index + 1);
      }
      break;
    case "ArrowLeft":
      if (expanded) onToggle();
      else if (parentKey) {
        rows.find((candidate) => candidate.dataset.key === parentKey)?.focus();
      }
      break;
    case "Enter":
      onActivate();
      break;
    case " ":
      // Selection already follows focus; Space toggles a section header and
      // otherwise only keeps the list from scrolling.
      onSpace?.();
      break;
    default:
      return;
  }
  event.preventDefault();
}

export function FolderTree({
  state,
  treeRef,
}: {
  state: FolderTreeState;
  treeRef: RefObject<HTMLUListElement | null>;
}) {
  return (
    <FolderTreeContext value={state}>
      <ul
        ref={treeRef}
        role="tree"
        aria-label="Workspace folders"
        className="flex flex-col gap-1"
        onFocus={(event) => {
          // Tabbing in lands on the fallback stop (the first header) until
          // something in the tree has had focus; send it on to the selected
          // folder when that is on screen.
          const tree = event.currentTarget;
          const from = event.relatedTarget;
          if (from instanceof Node && tree.contains(from)) return;
          if (state.focusKey !== null || state.selectedKey === null) return;
          const selectedRow = tree.querySelector<HTMLElement>(
            treeItemSelector(state.selectedKey),
          );
          if (selectedRow && selectedRow !== event.target) selectedRow.focus();
        }}
      >
        {sectionOrder.map((section, index) => (
          <TreeSection key={section} section={section} position={index + 1} />
        ))}
      </ul>
    </FolderTreeContext>
  );
}

function TreeSection({
  section,
  position,
}: {
  section: TreeSectionId;
  position: number;
}) {
  const tree = useFolderTree();
  const meta = sectionMeta[section];
  const key = sectionKey(section);
  const expanded = tree.expanded.has(key);
  const location = { kind: "list", view: meta.view } as const;
  const listing = useWorkspacePickerListing({
    location,
    username: tree.username,
  });
  const home = pickerHomePath(tree.username);
  const items = [
    ...buildPickerItems({
      items: filterListing({
        location,
        items: listing.items,
        target: folderTarget,
      }),
      target: folderTarget,
      showAll: false,
    }),
  ].sort(
    // Home first under My Workspaces; the sort is stable, so the rest stay
    // alphabetical.
    (a, b) =>
      Number(normalizePath(b.path) === home) -
      Number(normalizePath(a.path) === home),
  );
  const isTabStop =
    tree.focusKey === key || (tree.focusKey === null && section === "mine");
  const Icon = meta.icon;
  const toggle = () => {
    tree.onToggle(key);
  };

  return (
    <li role="none" className="flex flex-col">
      <div
        role="treeitem"
        aria-level={1}
        aria-expanded={expanded}
        aria-selected={false}
        aria-setsize={sectionOrder.length}
        aria-posinset={position}
        tabIndex={isTabStop ? 0 : -1}
        data-key={key}
        className="sticky top-0 z-10 flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-background px-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        onFocus={(event) => {
          if (event.target === event.currentTarget) tree.onFocusNode(key, null);
        }}
        onClick={toggle}
        onKeyDown={(event) => {
          handleTreeKeyDown(event, {
            key,
            parentKey: null,
            expanded,
            onToggle: toggle,
            onActivate: toggle,
            onSpace: toggle,
          });
        }}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            expanded && "rotate-90",
          )}
        />
        <Icon className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{meta.label}</span>
        {listing.isLoading ? (
          <Spinner className="size-3 shrink-0" />
        ) : listing.error ? null : (
          <span className="font-normal tabular-nums">{items.length}</span>
        )}
      </div>
      {expanded ? (
        <ul role="none" className="flex flex-col pb-2">
          <TreeNodeList
            items={items}
            isLoading={listing.isLoading}
            error={listing.error}
            emptyMessage={emptyListingMessage(location)}
            level={2}
            section={section}
            parentKey={key}
            parentPath={null}
            evidence={null}
          />
        </ul>
      ) : null}
    </li>
  );
}

function TreeStatusRow({
  tone,
  children,
}: {
  tone: "muted" | "error";
  children: ReactNode;
}) {
  return (
    <li
      role="none"
      className={cn(
        "flex min-h-7 items-center gap-2 py-1 pr-2 pl-7.5 text-xs",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </li>
  );
}

function TreeNodeList({
  items,
  isLoading,
  error,
  emptyMessage,
  level,
  section,
  parentKey,
  parentPath,
  evidence,
}: {
  items: WorkspaceItem[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  level: number;
  section: TreeSectionId;
  parentKey: string;
  /** `null` under a section header, where no folder can be created. */
  parentPath: string | null;
  evidence: WorkspaceItem | null;
}) {
  const tree = useFolderTree();
  const isCreatingHere = parentPath !== null && tree.creatingKey === parentKey;

  let body: ReactNode;
  if (isLoading) {
    body = (
      <TreeStatusRow tone="muted">
        <Spinner className="size-3.5" />
        Loading…
      </TreeStatusRow>
    );
  } else if (error) {
    body = <TreeStatusRow tone="error">{error.message}</TreeStatusRow>;
  } else if (items.length === 0) {
    body = isCreatingHere ? null : (
      <TreeStatusRow tone="muted">
        <span className="italic">{emptyMessage}</span>
      </TreeStatusRow>
    );
  } else {
    body = items.map((item, index) => (
      <TreeNode
        key={item.path}
        item={item}
        section={section}
        level={level}
        parentKey={parentKey}
        setSize={items.length}
        posInSet={index + 1}
        inheritedEvidence={evidence}
      />
    ));
  }

  return (
    <>
      {isCreatingHere ? (
        <NewFolderRow
          parentKey={parentKey}
          parentPath={parentPath}
          section={section}
        />
      ) : null}
      {body}
    </>
  );
}

function TreeChildren({
  path,
  section,
  level,
  parentKey,
  evidence,
}: {
  path: string;
  section: TreeSectionId;
  level: number;
  parentKey: string;
  evidence: WorkspaceItem | null;
}) {
  const tree = useFolderTree();
  const listing = useWorkspacePickerListing({
    location: { kind: "path", path },
    username: tree.username,
  });
  const items = buildPickerItems({
    items: listing.items,
    target: folderTarget,
    showAll: false,
  });

  return (
    // The left border is the indentation guide, under the parent's chevron.
    <ul role="none" className="ml-3.5 flex flex-col border-l border-border pl-1">
      <TreeNodeList
        items={items}
        isLoading={listing.isLoading}
        error={listing.error}
        emptyMessage="Empty"
        level={level}
        section={section}
        parentKey={parentKey}
        parentPath={path}
        evidence={evidence}
      />
    </ul>
  );
}

function TreeNode({
  item,
  section,
  level,
  parentKey,
  setSize,
  posInSet,
  inheritedEvidence,
}: {
  item: WorkspaceItem;
  section: TreeSectionId;
  level: number;
  parentKey: string;
  setSize: number;
  posInSet: number;
  inheritedEvidence: WorkspaceItem | null;
}) {
  const tree = useFolderTree();
  const rowRef = useRef<HTMLDivElement>(null);
  const path = normalizePath(item.path);
  const key = nodeKey(section, path);
  const expanded = tree.expanded.has(key);
  const selected = tree.selectedKey === key;
  const isTabStop = tree.focusKey === key;
  const evidence = item.permissions ? item : inheritedEvidence;
  const writable = canWriteTo({
    path,
    username: tree.username,
    item,
    siblings: inheritedEvidence ? [inheritedEvidence] : [],
  });
  const commit = pickerCommitState({
    target: folderTarget,
    path,
    writable,
    isSelectable: tree.isSelectable,
  });
  const isHome = section === "mine" && path === pickerHomePath(tree.username);
  const owner = level === 2 && section !== "mine" ? ownerLabel(path) : null;
  const target: TreeNodeTarget = { key, path, item: evidence };
  const { reveal } = tree;
  const FolderIcon = isHome ? House : expanded ? FolderOpen : Folder;

  const toggle = () => {
    tree.onToggle(key);
  };
  const activate = () => {
    if (commit.canCommit) tree.onCommit(path);
    else toggle();
  };

  useEffect(() => {
    if (reveal?.key !== key) return;
    const row = rowRef.current;
    if (!row) return;
    if (reveal.focus) row.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      row.scrollIntoView({ block: "center" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [reveal, key]);

  return (
    <li role="none" className="flex flex-col">
      <div
        ref={rowRef}
        role="treeitem"
        aria-level={level}
        aria-expanded={expanded}
        aria-selected={selected}
        aria-setsize={setSize}
        aria-posinset={posInSet}
        tabIndex={isTabStop ? 0 : -1}
        data-key={key}
        data-parent-key={parentKey}
        title={commit.reason ?? path}
        className={cn(
          "group/row flex h-8 scroll-mt-9 items-center gap-1.5 rounded-md px-1 outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          selected &&
            "bg-primary/15 hover:bg-primary/20 dark:bg-primary/30 dark:hover:bg-primary/35",
          !commit.canCommit && "text-muted-foreground",
        )}
        onFocus={(event) => {
          // Selection follows focus (click, arrows, programmatic).
          if (event.target === event.currentTarget) {
            tree.onFocusNode(key, target);
          }
        }}
        onDoubleClick={activate}
        onKeyDown={(event) => {
          handleTreeKeyDown(event, {
            key,
            parentKey,
            expanded,
            onToggle: toggle,
            onActivate: activate,
          });
        }}
      >
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </span>
        <FolderIcon
          className={cn(
            "size-4 shrink-0 text-highlight",
            !commit.canCommit && "opacity-50",
          )}
        />
        <span className="min-w-0 flex-1 truncate">
          {isHome ? "Home" : item.name}
          {owner ? (
            <span className="ml-1.5 text-2xs text-muted-foreground">
              {owner}
            </span>
          ) : null}
        </span>
        {writable ? (
          <span
            className={cn(
              "flex shrink-0 items-center opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
              selected && "opacity-100",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={isTabStop ? 0 : -1}
              aria-label={`New folder in ${isHome ? "Home" : item.name}`}
              title="New folder here"
              disabled={tree.isCreating}
              onClick={(event) => {
                event.stopPropagation();
                tree.onStartCreate(target);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
              }}
            >
              <FolderPlus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={isTabStop ? 0 : -1}
              aria-label={`Upload files to ${isHome ? "Home" : item.name}`}
              title="Upload files here"
              disabled={tree.isUploading}
              onClick={(event) => {
                event.stopPropagation();
                tree.onStartUpload(target);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Upload />
            </Button>
          </span>
        ) : (
          <Lock
            className="size-3 shrink-0 text-muted-foreground"
            aria-label="Read-only"
          />
        )}
      </div>
      {expanded ? (
        <TreeChildren
          path={path}
          section={section}
          level={level + 1}
          parentKey={key}
          evidence={evidence}
        />
      ) : null}
    </li>
  );
}

function NewFolderRow({
  parentKey,
  parentPath,
  section,
}: {
  parentKey: string;
  parentPath: string;
  section: TreeSectionId;
}) {
  const tree = useFolderTree();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameError = folderNameError(name);
  const message = error ?? (name.length > 0 ? nameError : null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (nameError !== null || tree.isCreating) return;
    setError(null);
    try {
      await tree.onCreate({ parentKey, section, parentPath, name });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create folder.",
      );
    }
  };

  return (
    <li role="none" className="flex flex-col">
      <div className="flex h-9 items-center gap-1.5 px-1">
        <span className="size-5 shrink-0" />
        <FolderPlus className="size-4 shrink-0 text-highlight" />
        <Input
          ref={inputRef}
          className="h-7"
          value={name}
          placeholder="New folder name"
          aria-label={`New folder in ${parentPath}`}
          aria-invalid={message !== null}
          disabled={tree.isCreating}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            } else if (event.key === "Escape") {
              // Cancel the row, not the sheet: Base UI dismisses on a
              // document keydown listener added after React's.
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              tree.onCancelCreate();
            }
          }}
          onBlur={() => {
            if (!name.trim() && !tree.isCreating) tree.onCancelCreate();
          }}
        />
        {tree.isCreating ? (
          <Spinner className="size-3.5 shrink-0" />
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Create folder"
              title="Create (Enter)"
              disabled={nameError !== null}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                void submit();
              }}
            >
              <Check />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Cancel new folder"
              title="Cancel (Esc)"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={tree.onCancelCreate}
            >
              <X />
            </Button>
          </>
        )}
      </div>
      {message ? (
        <p className="pb-1 pl-12 text-xs text-destructive">{message}</p>
      ) : null}
    </li>
  );
}
