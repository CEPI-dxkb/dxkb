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
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { toast } from "sonner";

const archiveTypeOptions = [{ value: "zip", label: "zip" }];

const invalidArchiveNameChars = /[~`!#$%^&*+=[\]\\';,/{}|":<>?]/g;

export interface DownloadOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  defaultArchiveName?: string;
}

// State lives inside the form so closing the dialog unmounts it and a reopen starts fresh.
function DownloadOptionsForm({
  paths,
  defaultArchiveName,
  onOpenChange,
}: {
  paths: string[];
  defaultArchiveName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const repository = useWorkspaceRepository("authenticated");

  const [archiveName, setArchiveName] = React.useState(defaultArchiveName);
  const [archiveType, setArchiveType] = React.useState("zip");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  const handleSubmit = async () => {
    const trimmed = archiveName.trim();
    if (!trimmed) {
      setValidationError("File name is required.");
      return;
    }
    const invalidChars = trimmed.match(invalidArchiveNameChars);
    if (invalidChars && invalidChars.length > 0) {
      const unique = [...new Set(invalidChars)];
      setValidationError(`Remove invalid characters: ${unique.join(", ")}`);
      toast.error(`Invalid file name. Remove: ${unique.join(", ")}`);
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
      const [url] = await repository.getArchiveUrl({
        paths,
        recursive: true,
        archiveName: nameWithExt,
        archiveType,
      });
      if (url) {
        window.location.assign(url);
        onOpenChange(false);
      } else {
        toast.error("Download failed: no URL returned.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed.";
      toast.error(message);
    }
    setIsSubmitting(false);
  };

  const canSubmit =
    archiveName.trim().length > 0 && !isSubmitting && paths.length > 0;

  return (
    <>
      <DialogTitle>Download File Options</DialogTitle>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
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
                if (canSubmit) void handleSubmit();
              }
            }}
            aria-invalid={!!validationError}
            aria-describedby={
              validationError ? "archive-name-error" : undefined
            }
          />
          {validationError && (
            <p
              id="archive-name-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {validationError}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="download-archive-type"
          >
            File Type
          </label>
          <Select
            value={archiveType}
            onValueChange={(value) => {
              if (value != null) setArchiveType(value);
            }}
            disabled={isSubmitting}
          >
            <SelectTrigger id="download-archive-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {archiveTypeOptions.map((opt) => (
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
          {isSubmitting ? <Spinner className="size-4 shrink-0" /> : "Submit"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DownloadOptionsDialog({
  open,
  onOpenChange,
  paths,
  defaultArchiveName = "",
}: DownloadOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DownloadOptionsForm
          paths={paths}
          defaultArchiveName={defaultArchiveName}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
