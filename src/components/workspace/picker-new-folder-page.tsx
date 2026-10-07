"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { folderNameError } from "@/lib/services/workspace/picker-views";

export interface PickerNewFolderPageProps {
  parentPath: string;
  isCreating: boolean;
  /** Rejects with the backend's error, which the page shows as-is. */
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}

/** The "New Folder" page of `WorkspacePickerDialog`. */
export function PickerNewFolderPage({
  parentPath,
  isCreating,
  onCreate,
  onCancel,
}: PickerNewFolderPageProps) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameError = folderNameError(name);
  const showNameError = name.length > 0 && nameError !== null;
  const canCreate = !isCreating && nameError === null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async () => {
    if (!canCreate) return;
    setError(null);
    try {
      await onCreate(name);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create folder.",
      );
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Create in:
          </span>
          <p className="rounded-md bg-muted/50 px-2 py-1.5 font-mono text-xs break-all">
            {parentPath}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={inputId}>Folder name</Label>
          <Input
            ref={inputRef}
            id={inputId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            disabled={isCreating}
            aria-invalid={showNameError}
            aria-describedby={showNameError ? errorId : undefined}
            placeholder="My Folder"
          />
          {showNameError ? (
            <p id={errorId} className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <DialogFooter showCloseButton={false}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            void handleCreate();
          }}
          disabled={!canCreate}
        >
          {isCreating ? (
            <>
              <Spinner className="mr-2 size-3.5 shrink-0" />
              Creating…
            </>
          ) : (
            "Create Folder"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
