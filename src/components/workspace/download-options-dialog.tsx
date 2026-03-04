"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  WorkspaceDownloadMethods,
} from "@/lib/services/workspace/methods/download";
import { workspaceApi } from "@/lib/services/workspace/client";
import { toast } from "sonner";

const ARCHIVE_TYPE_OPTIONS = [{ value: "zip", label: "zip" }];

/** Characters not allowed in archive file name (legacy validation). */
const INVALID_ARCHIVE_NAME_CHARS = /[~`!#$%^&*+=[\]\\';,/{}|":<>?]/g;

export interface DownloadOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  defaultArchiveName?: string;
  /** Injected for consistency and testability; uses default client when omitted. */
  downloadMethods?: WorkspaceDownloadMethods;
}

export function DownloadOptionsDialog({
  open,
  onOpenChange,
  paths,
  defaultArchiveName = "",
  downloadMethods: downloadMethodsProp,
}: DownloadOptionsDialogProps) {
  const defaultDownloadMethods = React.useMemo(
    () => new WorkspaceDownloadMethods(workspaceApi),
    [],
  );
  const downloadMethods = downloadMethodsProp ?? defaultDownloadMethods;

  const [archiveName, setArchiveName] = React.useState("");
  const [archiveType, setArchiveType] = React.useState("zip");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (open) {
      setArchiveName(defaultArchiveName ?? "");
      setArchiveType("zip");
      setValidationError(null);
    }
  }, [open, defaultArchiveName]);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = archiveName.trim();
    if (!trimmed) {
      setValidationError("File name is required.");
      return;
    }
    const invalidChars = trimmed.match(INVALID_ARCHIVE_NAME_CHARS);
    if (invalidChars && invalidChars.length > 0) {
      const unique = [...new Set(invalidChars)];
      setValidationError(
        `Remove invalid characters: ${unique.join(", ")}`,
      );
      toast.error(
        `Invalid file name. Remove: ${unique.join(", ")}`,
      );
      return;
    }
    setValidationError(null);

    let nameWithExt = trimmed;
    if (!nameWithExt.toLowerCase().endsWith(`.${archiveType}`)) {
      nameWithExt = `${nameWithExt}.${archiveType}`;
    }

    if (paths.length === 0) {
      toast.error("No files selected for download.");
      return;
    }

    setIsSubmitting(true);
    try {
      const [url] = await downloadMethods.getArchiveUrl({
        objects: paths,
        recursive: true,
        archive_name: nameWithExt,
        archive_type: archiveType,
      });
      if (url) {
        window.location.assign(url);
        onOpenChange(false);
      } else {
        toast.error("Download failed: no URL returned.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Download failed.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [archiveName, archiveType, paths, onOpenChange, downloadMethods]);

  const canSubmit =
    archiveName.trim().length > 0 && !isSubmitting && paths.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Download File Options</DialogTitle>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="download-archive-name"
            >
              File Name
            </label>
            <Input
              id="download-archive-name"
              value={archiveName}
              onChange={(e) => {
                setArchiveName(e.target.value);
                setValidationError(null);
              }}
              placeholder={defaultArchiveName}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canSubmit) handleSubmit();
                }
              }}
              aria-invalid={!!validationError}
              aria-describedby={validationError ? "archive-name-error" : undefined}
            />
            {validationError && (
              <p
                id="archive-name-error"
                className="text-destructive text-xs"
                role="alert"
              >
                {validationError}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="download-archive-type"
            >
              File Type
            </label>
            <Select
              value={archiveType}
              onValueChange={(value) => value != null && setArchiveType(value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="download-archive-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup> 
                  {ARCHIVE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <Spinner className="h-4 w-4 shrink-0" />
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
