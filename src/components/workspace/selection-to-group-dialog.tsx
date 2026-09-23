"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceMiniBrowser } from "./workspace-mini-browser";
import { WorkspaceObjectSelector } from "./workspace-object-selector";
import type { WorkspaceSelectorPreset } from "./workspace-selector-presets";
import { sanitizePathSegment } from "@/lib/services/workspace/path-utils";

/** The two ID group kinds a row selection can produce. */
export type SelectionGroupKind = "genome" | "feature";

export interface SelectionToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: readonly string[];
  /** Genome Groups hold `genome_id`s, Feature Groups hold `feature_id`s. */
  groupKind?: SelectionGroupKind;
  defaultFolder: string;
  onCreate: (folderPath: string, name: string) => Promise<void>;
  onAppend: (path: string) => Promise<void>;
}

type GroupMode = "new" | "existing";

const groupCopy = {
  genome: {
    title: "Add Genomes to Group",
    singular: "genome",
    plural: "genomes",
    groupLabel: "Genome group",
    namePlaceholder: "My Genome Group",
    searchPlaceholder: "Search genome groups...",
    preset: "genomeGroup",
  },
  feature: {
    title: "Add Features to Group",
    singular: "feature",
    plural: "features",
    groupLabel: "Feature group",
    namePlaceholder: "My Feature Group",
    searchPlaceholder: "Search feature groups...",
    preset: "featureGroup",
  },
} as const satisfies Record<
  SelectionGroupKind,
  {
    title: string;
    singular: string;
    plural: string;
    groupLabel: string;
    namePlaceholder: string;
    searchPlaceholder: string;
    preset: WorkspaceSelectorPreset;
  }
>;

function getGroupNameError(name: string): string | null {
  const sanitizedName = sanitizePathSegment(name);
  if (!sanitizedName) return "Enter a group name.";
  if (sanitizedName === "." || sanitizedName === "..") {
    return 'Group name cannot be "." or "..".';
  }
  if (sanitizedName.includes("/")) {
    return "Group name cannot contain a slash.";
  }
  return null;
}

function SelectionToGroupForm({
  ids,
  groupKind = "genome",
  defaultFolder,
  onOpenChange,
  onCreate,
  onAppend,
  sessionRef,
}: Omit<SelectionToGroupDialogProps, "open"> & {
  sessionRef: RefObject<number>;
}) {
  const copy = groupCopy[groupKind];
  const [mode, setMode] = useState<GroupMode>("new");
  const [folderPath, setFolderPath] = useState(defaultFolder);
  const workspaceRoot =
    defaultFolder.match(/^\/[^/]+\/home/)?.[0] ?? defaultFolder;
  const [groupName, setGroupName] = useState("");
  const [existingGroupPath, setExistingGroupPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sanitizedGroupName = sanitizePathSegment(groupName);
  const groupNameError = getGroupNameError(groupName);
  const canSubmit =
    !isSubmitting &&
    ids.length > 0 &&
    (mode === "new"
      ? folderPath.trim().length > 0 && groupNameError === null
      : existingGroupPath.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const session = sessionRef.current;
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "new") {
        await onCreate(folderPath.trim(), sanitizedGroupName);
      } else {
        await onAppend(existingGroupPath);
      }
      if (session === sessionRef.current) onOpenChange(false);
    } catch (submitError) {
      if (session === sessionRef.current) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : `Unable to update the ${groupKind} group.`,
        );
      }
    }
    if (session === sessionRef.current) setIsSubmitting(false);
  };

  const selectionLabel = ids.length === 1 ? copy.singular : copy.plural;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          {ids.length.toLocaleString()} selected {selectionLabel}
        </DialogDescription>
      </DialogHeader>

      <Tabs
        className="flex min-h-0 flex-col overflow-hidden"
        value={mode}
        onValueChange={(value) => {
          setMode(value as GroupMode);
          setError(null);
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="new" disabled={isSubmitting}>
            New Group
          </TabsTrigger>
          <TabsTrigger value="existing" disabled={isSubmitting}>
            Existing Group
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="min-h-0 overflow-y-auto pt-2 pr-1">
          <div className="grid gap-4">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="selection-group-folder">Folder path</Label>
              <Input
                id="selection-group-folder"
                value={folderPath}
                disabled
                placeholder="Select a folder below"
              />
              <WorkspaceMiniBrowser
                className="h-[min(20rem,40dvh)] min-w-0"
                initialPath={defaultFolder}
                workspaceRoot={workspaceRoot}
                selectedPath={folderPath}
                mode="folders-only"
                onSelectPath={(path) => {
                  setFolderPath(path);
                  setError(null);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="selection-group-name">Group name</Label>
              <Input
                id="selection-group-name"
                value={groupName}
                onChange={(event) => {
                  setGroupName(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={groupName.length > 0 && groupNameError !== null}
                aria-describedby={
                  groupNameError ? "selection-group-name-error" : undefined
                }
                placeholder={copy.namePlaceholder}
              />
              {groupName.length > 0 && groupNameError ? (
                <p
                  id="selection-group-name-error"
                  className="text-xs text-destructive"
                >
                  {groupNameError}
                </p>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="existing" className="grid gap-2 pt-2">
          <Label htmlFor="selection-existing-group">{copy.groupLabel}</Label>
          <WorkspaceObjectSelector
            id="selection-existing-group"
            preset={copy.preset}
            value={existingGroupPath}
            placeholder={copy.searchPlaceholder}
            onSelectedObjectChange={(object) => {
              setExistingGroupPath(object?.path ?? "");
              setError(null);
            }}
          />
        </TabsContent>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
          }}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            void handleSubmit();
          }}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2 size-3.5 shrink-0" />
              {mode === "new" ? "Creating..." : "Adding..."}
            </>
          ) : mode === "new" ? (
            "Create Group"
          ) : (
            "Add to Group"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function SelectionToGroupDialog({
  open,
  onOpenChange,
  ids,
  groupKind = "genome",
  defaultFolder,
  onCreate,
  onAppend,
}: SelectionToGroupDialogProps) {
  /**
   * Identifies the current dialog session so a create or append that resolves after
   * the dialog was closed cannot close, error, or unblock a later session. The form
   * unmounts with the popup, so the token has to live out here to outlast it.
   */
  const sessionRef = useRef(0);
  useEffect(() => {
    // Every open/close transition — including one driven by the parent — ends the
    // previous session, so any submission still in flight is no longer current.
    sessionRef.current += 1;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <SelectionToGroupForm
          ids={ids}
          groupKind={groupKind}
          defaultFolder={defaultFolder}
          onOpenChange={onOpenChange}
          onCreate={onCreate}
          onAppend={onAppend}
          sessionRef={sessionRef}
        />
      </DialogContent>
    </Dialog>
  );
}
