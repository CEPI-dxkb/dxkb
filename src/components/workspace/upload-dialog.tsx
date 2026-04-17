"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const uploadApi = "/api/services/workspace/upload";

const uploadTypeOptions = Object.entries(knownUploadTypes).map(([value, { label }]) => ({
  value,
  label,
}));

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPath: string;
  onUploadComplete: () => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  targetPath,
  onUploadComplete,
}: UploadDialogProps) {
  const [uploadType, setUploadType] = React.useState<string>("unspecified");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const repository = useWorkspaceRepository("authenticated");

  React.useEffect(() => {
    if (open) {
      setFiles([]);
      setUploadType("unspecified");
    }
  }, [open]);

  const addFiles = React.useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles).filter((f) => f.name && f.size !== undefined);
    setFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      list.forEach((f) => byName.set(f.name, f));
      return Array.from(byName.values());
    });
  }, []);

  const removeFile = React.useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const onInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (selected?.length) addFiles(selected);
      e.target.value = "";
    },
    [addFiles],
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const onDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = React.useCallback((_e: React.DragEvent) => {
    setIsDragActive(false);
  }, []);

  const handleStartUpload = React.useCallback(async () => {
    if (!files.length || !targetPath.trim() || isUploading) return;
    setIsUploading(true);
    let hasError = false;
    try {
      for (const file of files) {
        const { linkReference } = await repository.createUploadNode({
          directoryPath: targetPath,
          filename: file.name,
          type: uploadType,
        });
        const formData = new FormData();
        formData.append("url", linkReference);
        formData.append("file", file);
        const res = await fetch(uploadApi, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          toast.error(`Upload failed: ${file.name}`, {
            description: (err as { error?: string }).error ?? res.statusText,
          });
          hasError = true;
          break;
        }
        const dir = targetPath.endsWith("/") ? targetPath : targetPath + "/";
        const fullPath = dir + file.name;
        await repository.updateAutoMetadata([fullPath]);
      }
      if (!hasError) {
        toast.success("Upload complete", {
          description: `${files.length} file(s) uploaded.`,
        });
        onUploadComplete();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      toast.error(message);
      hasError = true;
    } finally {
      setIsUploading(false);
    }
  }, [files, targetPath, uploadType, isUploading, repository, onUploadComplete]);

  const canStart = files.length > 0 && !isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!isUploading}>
        <DialogTitle>Upload</DialogTitle>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Upload file to:
            </span>
            <p className="bg-muted/50 rounded-md px-2 py-1.5 font-mono text-xs break-all">
              {targetPath || "—"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Upload type:
            </span>
            <Select
              value={uploadType}
              onValueChange={(v) => v != null && setUploadType(v)}
              items={uploadTypeOptions}
            >
              <SelectTrigger className="w-full">
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
            <span className="text-muted-foreground text-xs font-medium">
              File selection
            </span>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "border-border bg-muted/30 flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors",
                "hover:bg-muted/50 focus-visible:ring-ring outline-none focus-visible:ring-2",
                isDragActive && "bg-muted/50",
              )}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="*"
                onChange={onInputChange}
              />
              <Button type="button" variant="secondary" size="sm">
                Select Files
              </Button>
              <span className="text-muted-foreground text-xs">or Drop files here.</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              File Selected
            </span>
            <div className="border-border rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-muted-foreground text-left font-medium px-2 py-1.5">
                      File
                    </th>
                    <th className="text-muted-foreground text-left font-medium px-2 py-1.5">
                      Type
                    </th>
                    <th className="text-muted-foreground text-left font-medium px-2 py-1.5">
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
                        className="text-muted-foreground italic px-2 py-2"
                      >
                        None
                      </td>
                    </tr>
                  ) : (
                    files.map((file) => (
                      <tr key={file.name} className="border-t border-border/50">
                        <td className="px-2 py-1.5 truncate max-w-[180px]">
                          {file.name}
                        </td>
                        <td className="px-2 py-1.5">{uploadType}</td>
                        <td className="px-2 py-1.5">{file.size}</td>
                        <td className="px-1 py-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.name);
                            }}
                            disabled={isUploading}
                            aria-label={`Remove ${file.name}`}
                          >
                            <XIcon className="h-3.5 w-3.5" />
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
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleStartUpload()} disabled={!canStart}>
            {isUploading ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                Uploading…
              </>
            ) : (
              "Start Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
