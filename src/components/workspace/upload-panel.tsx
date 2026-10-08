"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { knownUploadTypes } from "@/lib/services/workspace/types";
import { invalidateWorkspace } from "@/lib/services/workspace/workspace-query-keys";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const uploadApi = "/api/services/workspace/upload";

const uploadTypeOptions = Object.entries(knownUploadTypes).map(
  ([value, { label }]) => ({
    value,
    label,
  }),
);

export interface WorkspaceUploadPanelProps {
  targetPath: string;
  onCancel: () => void;
  onUploadComplete: () => void;
  /** Reports when an upload starts and ends, e.g. to hide a close button. */
  onUploadingChange?: (uploading: boolean) => void;
  cancelLabel?: string;
}

/**
 * Upload form (type, file picker, file list) with its Cancel / Start Upload
 * footer, for use inside a dialog: `UploadDialog` in the workspace browser, and
 * the upload pane of `WorkspaceFolderPickerDialog`. State lives here, so it
 * resets whenever the panel mounts.
 */
export function WorkspaceUploadPanel({
  targetPath,
  onCancel,
  onUploadComplete,
  onUploadingChange,
  cancelLabel = "Cancel",
}: WorkspaceUploadPanelProps) {
  const [uploadType, setUploadType] = React.useState<string>("unspecified");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploadingState] = React.useState(false);
  const setIsUploading = (value: boolean) => {
    setIsUploadingState(value);
    onUploadingChange?.(value);
  };
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const repository = useWorkspaceRepository("authenticated");
  const queryClient = useQueryClient();

  const addFiles = (newFiles: FileList | File[]) => {
    const list = Array.from(newFiles).filter((f) => f.name);
    setFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      list.forEach((f) => byName.set(f.name, f));
      return Array.from(byName.values());
    });
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected?.length) addFiles(selected);
    e.target.value = "";
  };

  // A running upload works through the files and type it started with, so the
  // form is frozen until it ends: anything added meanwhile would be dropped.
  const openFilePicker = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  // Drops are still handled while uploading, only refused, so the browser
  // does not open the dropped file in place of the page.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (isUploading) return;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(!isUploading);
    e.dataTransfer.dropEffect = isUploading ? "none" : "copy";
  };

  const onDragLeave = (_e: React.DragEvent) => {
    setIsDragActive(false);
  };

  const handleStartUpload = async () => {
    if (!files.length || !targetPath.trim() || isUploading) return;
    setIsUploading(true);
    let hasError = false;
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const dir = targetPath.endsWith("/") ? targetPath : targetPath + "/";
        const fullPath = dir + file.name;
        const { linkReference } = await repository.createUploadNode({
          directoryPath: targetPath,
          filename: file.name,
          type: uploadType,
        });
        // Workspace.create has made the object (it refuses an existing name,
        // so this is ours). If the data never reaches Shock it is an empty
        // entry that cannot be opened, so take it back out. Best effort: the
        // upload error is what the user needs to see.
        const discardObject = () =>
          repository.delete([fullPath]).catch(() => undefined);
        const formData = new FormData();
        formData.append("url", linkReference);
        formData.append("file", file);
        let res: Response;
        try {
          res = await fetch(uploadApi, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
        } catch (err) {
          await discardObject();
          throw err;
        }
        if (!res.ok) {
          const err = await (res.json() as Promise<{ error?: string }>).catch(
            () => ({ error: res.statusText }),
          );
          await discardObject();
          toast.error(`Upload failed: ${file.name}`, {
            description: err.error ?? res.statusText,
          });
          hasError = true;
          break;
        }
        uploadedCount += 1;
        await repository.updateAutoMetadata([fullPath]);
      }
      if (!hasError) {
        toast.success("Upload complete", {
          description: `${String(files.length)} file(s) uploaded.`,
        });
        onUploadComplete();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      toast.error(message);
      hasError = true;
    }
    // The files before the one that failed stay uploaded, and the panel stays
    // open without onUploadComplete, so refresh the listings that show them.
    if (hasError && uploadedCount > 0) invalidateWorkspace(queryClient);
    setIsUploading(false);
  };

  const canStart = files.length > 0 && !isUploading;

  return (
    <>
      {/* Fills and, if it must, scrolls the space above the footer when the
          panel sits in a fixed-height dialog; -mx-1/px-1 keep focus rings. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Upload file to:
          </span>
          <p className="rounded-md bg-muted/50 px-2 py-1.5 font-mono text-xs break-all">
            {targetPath || "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Upload type:
          </span>
          <Select
            value={uploadType}
            onValueChange={(v) => {
              if (v != null) setUploadType(v);
            }}
            items={uploadTypeOptions}
            disabled={isUploading}
          >
            <SelectTrigger className="w-full" aria-label="Upload type">
              <SelectValue placeholder="Unspecified" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {uploadTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            File selection
          </span>
          <div
            role="button"
            tabIndex={isUploading ? -1 : 0}
            aria-disabled={isUploading || undefined}
            className={cn(
              "flex min-h-30 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isUploading ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50",
              isDragActive && "bg-muted/50",
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFilePicker();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="*"
              disabled={isUploading}
              onChange={onInputChange}
            />
            <span className="pointer-events-none inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-xs select-none">
              Select Files
            </span>
            <span className="text-xs text-muted-foreground">
              or Drop files here.
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            File Selected
          </span>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    File
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Size
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-2 text-muted-foreground italic"
                    >
                      None
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.name} className="border-t border-border/50">
                      <td className="max-w-45 truncate px-2 py-1.5">
                        {file.name}
                      </td>
                      <td className="px-2 py-1.5">{uploadType}</td>
                      <td className="px-2 py-1.5">{file.size}</td>
                      <td className="p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.name);
                          }}
                          disabled={isUploading}
                          aria-label={`Remove ${file.name}`}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <DialogFooter showCloseButton={false}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isUploading}
        >
          {cancelLabel}
        </Button>
        <Button onClick={() => void handleStartUpload()} disabled={!canStart}>
          {isUploading ? (
            <>
              <Spinner className="mr-2 size-3.5 shrink-0" />
              Uploading…
            </>
          ) : (
            "Start Upload"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
