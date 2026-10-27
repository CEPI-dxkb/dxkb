"use client";

/**
 * The folder picker's info pane, pinned to the right of the columns: either
 * the selected folder's details (write access, New folder / Upload here), the
 * selected file's when picking files, or, in their place, the upload form for
 * that folder. The details fade in whenever the selection changes, whichever
 * way the user moved, so going into a folder and back out look the same.
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  BriefcaseMedical,
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
import { WorkspaceItemIcon } from "@/components/workspace/workspace-item-icon";
import { WorkspaceUploadPanel } from "@/components/workspace/upload-panel";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import {
  formatDate,
  formatFileSize,
  formatOwner,
} from "@/lib/services/workspace/helpers";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import {
  isHiddenPickerItem,
  lastSegment,
  pathSegments,
  pickerPathLabel,
  pickerTypeLabel,
  viewLabel,
  type PickerTarget,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import {
  isFolder,
  normalizeWorkspaceObjectType,
} from "@/lib/services/workspace/utils";
import { cn, formatUserFacingErrorMessage } from "@/lib/utils";
import { folderTarget, placeIcons } from "./folder-picker-utils";

const placeHints: Record<PickerView, string> = {
  home: "Your home folder.",
  myWorkspaces: "Pick one of your workspaces to see its folders.",
  shared: "Workspaces other people shared with you, where you can write.",
  public: "Public workspaces are read-only: browse them, but save elsewhere.",
  favorites: "Folders you starred in the workspace browser.",
  recent: "Folders you used recently, newest first.",
};

/**
 * Picking files, read-only workspaces are fair game (the choice is read, not
 * written to), so Shared and Public say that instead.
 */
const filePlaceHints: Record<PickerView, string> = {
  ...placeHints,
  shared: "Workspaces other people shared with you, including read-only ones.",
  public: "Public workspaces you can browse and pick files from.",
};

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

interface FolderPickerInfoProps {
  /** What the picker chooses; picking files, a folder is only browsed. */
  target?: PickerTarget;
  place: PickerView;
  /** The selected folder; `null` when a listing (not a folder) is open. */
  path: string | null;
  homePath: string;
  /** The selected folder's row, when its column has loaded. */
  item: WorkspaceItem | null;
  /** The selected folder's own listing; `error` when it failed. */
  contents: { items: WorkspaceItem[]; isLoading: boolean; error?: Error | null };
  /**
   * A listing the pane relies on failed (the folder's own, or the one holding
   * its row): the pane says so in place of claiming write access.
   */
  listingError?: Error | null;
  commit: { canCommit: boolean; reason: string | null };
  canChange: boolean;
  onNewFolder: () => void;
  onUpload: () => void;
}

export function FolderPickerInfo({
  target = folderTarget,
  place,
  path,
  homePath,
  item,
  contents,
  listingError = null,
  commit,
  canChange,
  onNewFolder,
  onUpload,
}: FolderPickerInfoProps) {
  if (!path) {
    const PlaceIcon = placeIcons[place];
    const hints = target.kind === "object" ? filePlaceHints : placeHints;
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
            {hints[place]}
          </p>
        </div>
      </PaneFrame>
    );
  }

  const isPickingFiles = target.kind === "object";
  const isHome = path === homePath;
  const isWorkspaceRoot = pathSegments(path).length === 2;
  // Picking files, a job result opens as its hidden (dot) folder.
  const isJobFolder = isPickingFiles && lastSegment(path).startsWith(".");
  const FolderIcon: LucideIcon = isHome
    ? House
    : isWorkspaceRoot
      ? place === "shared" || place === "public"
        ? placeIcons[place]
        : HardDrive
      : isJobFolder
        ? BriefcaseMedical
        : Folder;
  const name = pickerPathLabel(path, homePath, target);
  const owner = formatOwner(item?.ownerId ?? pathSegments(path).at(0) ?? "");
  const created = item?.createdAt ? formatDate(item.createdAt) : null;
  // Hidden items the columns leave out don't count here either.
  const children = contents.items.filter(
    (child) =>
      !isHiddenPickerItem({
        item: child,
        location: { kind: "path", path },
        items: contents.items,
        target,
      }),
  );
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
                : contents.error
                  ? "Couldn't check"
                  : children.length === 0
                    ? "Nothing yet"
                    : `${plural(folders, "folder")}, ${plural(files, "file")}`
            }
          />
        </dl>

        {/* A failed read leaves both contents and write access unknown, so
            the pane claims neither. Picking files, a folder is never the
            choice, so its reason ("Pick a file: Contigs.") is guidance rather
            than an error. */}
        {listingError ? (
          <CommitNote
            commit={{
              canCommit: false,
              reason: `Couldn't check this folder's contents or write access: ${formatUserFacingErrorMessage(
                listingError,
                "the workspace service gave no reason.",
              )}`,
            }}
            okText=""
          />
        ) : isPickingFiles ? (
          <p className="text-xs text-muted-foreground">{commit.reason}</p>
        ) : (
          <CommitNote
            commit={commit}
            okText="You can write here, so results can be saved in this folder."
          />
        )}

        <div
          className={cn(
            "mt-auto grid gap-2 md:flex md:flex-col",
            !isPickingFiles && "grid-cols-2",
          )}
        >
          {isPickingFiles ? null : (
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
          )}
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

interface FilePickerInfoProps {
  item: WorkspaceItem;
  place: PickerView;
  commit: { canCommit: boolean; reason: string | null };
}

/** The selected file's details, in place of a folder's, when picking files. */
export function FilePickerInfo({ item, place, commit }: FilePickerInfoProps) {
  const path = normalizePath(item.path);
  return (
    <PaneFrame label="Info">
      <div
        key={path}
        className="scrollbar-themed flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 duration-150 animate-in fade-in-0"
      >
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
            <WorkspaceItemIcon type={item.type} className="size-11" />
          </div>
          <p className="text-base font-medium break-all">{item.name}</p>
          <p className="font-mono text-2xs break-all text-muted-foreground">
            {path}
          </p>
        </div>
        <dl className="flex flex-col gap-1.5 text-xs">
          <DetailRow
            term="Type"
            value={pickerTypeLabel(normalizeWorkspaceObjectType(item.type))}
          />
          <DetailRow term="Size" value={formatFileSize(item.size)} />
          <DetailRow term="Where" value={viewLabel(place)} />
          <DetailRow
            term="Owner"
            value={formatOwner(item.ownerId ?? pathSegments(path).at(0) ?? "")}
          />
          {item.createdAt ? (
            <DetailRow term="Created" value={formatDate(item.createdAt)} />
          ) : null}
        </dl>
        <CommitNote commit={commit} okText="You can use this file here." />
      </div>
    </PaneFrame>
  );
}

/** Whether the selection can be chosen: `okText`, or the reason it can't. */
function CommitNote({
  commit,
  okText,
}: {
  commit: { canCommit: boolean; reason: string | null };
  okText: string;
}) {
  return (
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
      <p>{commit.canCommit ? okText : commit.reason}</p>
    </div>
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
  /** What the picker chooses; picking files, a job folder drops its dot. */
  target?: PickerTarget;
  targetPath: string;
  homePath: string;
  /** The upload type the form starts with, e.g. the type being picked. */
  initialUploadType?: string;
  isUploading: boolean;
  onBack: () => void;
  onComplete: (uploaded: { path: string; type: string }[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}

/** The upload form for the selected folder, in place of the preview. */
export function FolderPickerUpload({
  target = folderTarget,
  targetPath,
  homePath,
  initialUploadType,
  isUploading,
  onBack,
  onComplete,
  onUploadingChange,
}: FolderPickerUploadProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const name = pickerPathLabel(targetPath, homePath, target);

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
          initialUploadType={initialUploadType}
          onCancel={onBack}
          onUploadComplete={onComplete}
          onUploadingChange={onUploadingChange}
          cancelLabel="Back"
        />
      </div>
    </PaneFrame>
  );
}
