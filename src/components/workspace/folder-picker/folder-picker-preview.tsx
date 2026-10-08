"use client";

/**
 * The folder picker's info pane, pinned to the right of the columns: either
 * the selected folder's details (write access, New folder / Upload here) or,
 * in its place, the upload form for that folder. The details fade in whenever
 * the selection changes, whichever way the user moved, so going into a folder
 * and back out look the same.
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Folder,
  FolderPlus,
  HardDrive,
  House,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceUploadPanel } from "@/components/workspace/upload-panel";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { formatDate, formatOwner } from "@/lib/services/workspace/helpers";
import {
  lastSegment,
  pathSegments,
  viewLabel,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { isFolder } from "@/lib/services/workspace/utils";
import { cn } from "@/lib/utils";
import { placeIcons } from "./folder-picker-utils";

const placeHints: Record<PickerView, string> = {
  home: "Your home folder.",
  myWorkspaces: "Pick one of your workspaces to see its folders.",
  shared: "Workspaces other people shared with you, where you can write.",
  public: "Public workspaces are read-only: browse them, but save elsewhere.",
  favorites: "Folders you starred in the workspace browser.",
  recent: "Folders you used recently, newest first.",
};

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

interface FolderPickerInfoProps {
  place: PickerView;
  /** The selected folder; `null` when a listing (not a folder) is open. */
  path: string | null;
  homePath: string;
  /** The selected folder's row, when its column has loaded. */
  item: WorkspaceItem | null;
  contents: { items: WorkspaceItem[]; isLoading: boolean };
  commit: { canCommit: boolean; reason: string | null };
  canChange: boolean;
  onNewFolder: () => void;
  onUpload: () => void;
}

export function FolderPickerInfo({
  place,
  path,
  homePath,
  item,
  contents,
  commit,
  canChange,
  onNewFolder,
  onUpload,
}: FolderPickerInfoProps) {
  if (!path) {
    const PlaceIcon = placeIcons[place];
    return (
      <PaneFrame label="Info">
        <div
          key={place}
          className="flex flex-1 flex-col items-center justify-center gap-1.5 p-3 text-center duration-150 animate-in fade-in-0 md:gap-3 md:p-6"
        >
          <div className="hidden size-16 items-center justify-center rounded-2xl bg-muted md:flex">
            <PlaceIcon aria-hidden className="size-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{viewLabel(place)}</p>
          <p className="text-xs text-muted-foreground md:max-w-56">
            {placeHints[place]}
          </p>
        </div>
      </PaneFrame>
    );
  }

  const isHome = path === homePath;
  const isWorkspaceRoot = pathSegments(path).length === 2;
  const FolderIcon: LucideIcon = isHome
    ? House
    : isWorkspaceRoot
      ? place === "shared" || place === "public"
        ? placeIcons[place]
        : HardDrive
      : Folder;
  const name = isHome ? "Home" : lastSegment(path);
  const owner = formatOwner(item?.ownerId ?? pathSegments(path).at(0) ?? "");
  const created = item?.createdAt ? formatDate(item.createdAt) : null;
  // Hidden (dot) items never show in the columns, so they don't count here.
  const children = contents.items.filter((child) => !child.name.startsWith("."));
  const folders = children.filter((child) => isFolder(child.type)).length;
  const files = children.length - folders;

  return (
    <PaneFrame label="Info">
      <div
        key={path}
        className="scrollbar-themed flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 duration-150 animate-in fade-in-0 md:gap-4 md:p-4"
      >
        {/* Stacked under the columns on a narrow screen, the pane keeps only
            what decides the choice: whether it can be written to, and the
            actions. The footer already names the folder. */}
        <div className="hidden flex-col items-center gap-2 pt-2 text-center md:flex">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-highlight/10">
            <FolderIcon aria-hidden className="size-11 text-highlight" />
          </div>
          <p className="text-base font-medium break-all">{name}</p>
          <p className="font-mono text-2xs break-all text-muted-foreground">
            {path}
          </p>
        </div>

        <dl className="hidden flex-col gap-1.5 text-xs md:flex">
          <DetailRow term="Where" value={viewLabel(place)} />
          <DetailRow term="Owner" value={owner} />
          {created ? <DetailRow term="Created" value={created} /> : null}
          <DetailRow
            term="Contains"
            value={
              contents.isLoading
                ? "…"
                : children.length === 0
                  ? "Nothing yet"
                  : `${plural(folders, "folder")}, ${plural(files, "file")}`
            }
          />
        </dl>

        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
            commit.canCommit
              ? "border-success/30 bg-success/5 text-success"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {commit.canCommit ? (
            <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          )}
          <p>
            {commit.canCommit
              ? "You can write here, so results can be saved in this folder."
              : commit.reason}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 md:flex md:flex-col">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canChange}
            onClick={onNewFolder}
          >
            <FolderPlus data-icon="inline-start" />
            New folder here
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canChange}
            onClick={onUpload}
          >
            <Upload data-icon="inline-start" />
            Upload here
          </Button>
        </div>
      </div>
    </PaneFrame>
  );
}

function DetailRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 truncate text-right" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PaneFrame({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-3 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

interface FolderPickerUploadProps {
  targetPath: string;
  homePath: string;
  isUploading: boolean;
  onBack: () => void;
  onComplete: () => void;
  onUploadingChange: (uploading: boolean) => void;
}

/** The upload form for the selected folder, in place of the preview. */
export function FolderPickerUpload({
  targetPath,
  homePath,
  isUploading,
  onBack,
  onComplete,
  onUploadingChange,
}: FolderPickerUploadProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const name = targetPath === homePath ? "Home" : lastSegment(targetPath);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <PaneFrame
      label={
        <>
          <Button
            ref={backRef}
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-ml-2"
            aria-label="Back to folder info"
            title="Back to folder info"
            disabled={isUploading}
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
          <span className="min-w-0 truncate">Upload to “{name}”</span>
        </>
      }
    >
      {/* The panel's footer bleeds by -mx-4 -mb-4 (it was built for a p-4
          dialog), so this p-4 wrapper gives it the room. */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <WorkspaceUploadPanel
          targetPath={targetPath}
          onCancel={onBack}
          onUploadComplete={onComplete}
          onUploadingChange={onUploadingChange}
          cancelLabel="Back"
        />
      </div>
    </PaneFrame>
  );
}
