"use client";

import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";
import type { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import { CopyToDialog } from "./copy-to-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { DownloadOptionsDialog } from "./download-options-dialog";
import { EditTypeDialog } from "./edit-type-dialog";
import { FileViewerConstructionDialog } from "./file-viewer-construction-dialog";
import { UploadDialog } from "./upload-dialog";

interface WorkspaceDialogsProps {
  currentUserWorkspaceRoot: string;
  currentDirectoryPath: string;
  workspaceDownload: WorkspaceDownloadMethods;
  isDialogLoading: boolean;
  onConfirmDelete: () => Promise<void>;
  onCopyConfirm: (destPath: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateWorkspace: (name: string) => Promise<void>;
  onEditTypeConfirm: (newType: string) => Promise<void>;
  onRefetch: () => void;
}

export function WorkspaceDialogs({
  currentUserWorkspaceRoot,
  currentDirectoryPath,
  workspaceDownload,
  isDialogLoading,
  onConfirmDelete,
  onCopyConfirm,
  onCreateFolder,
  onCreateWorkspace,
  onEditTypeConfirm,
  onRefetch,
}: WorkspaceDialogsProps) {
  const { state: { activeDialog }, dispatch } = useWorkspaceDialog();

  const closeDialog = (open: boolean) => {
    if (!open) dispatch({ type: "CLOSE" });
  };

  return (
    <>
      <CopyToDialog
        open={activeDialog?.type === "copy"}
        onOpenChange={closeDialog}
        sourceItems={activeDialog?.type === "copy" ? activeDialog.items : []}
        currentUserWorkspaceRoot={currentUserWorkspaceRoot}
        onConfirm={onCopyConfirm}
        isCopying={activeDialog?.type === "copy" && isDialogLoading}
        mode={activeDialog?.type === "copy" ? activeDialog.mode : "copy"}
      />
      <EditTypeDialog
        open={activeDialog?.type === "editType"}
        onOpenChange={closeDialog}
        item={activeDialog?.type === "editType" ? activeDialog.item : null}
        onConfirm={(newType) => onEditTypeConfirm(newType)}
        isUpdating={activeDialog?.type === "editType" && isDialogLoading}
      />
      <CreateFolderDialog
        open={activeDialog?.type === "createFolder"}
        onOpenChange={closeDialog}
        onCreateFolder={onCreateFolder}
        isCreating={activeDialog?.type === "createFolder" && isDialogLoading}
      />
      <CreateWorkspaceDialog
        open={activeDialog?.type === "createWorkspace"}
        onOpenChange={closeDialog}
        onCreateWorkspace={onCreateWorkspace}
        isCreating={activeDialog?.type === "createWorkspace" && isDialogLoading}
      />
      <UploadDialog
        open={activeDialog?.type === "upload"}
        onOpenChange={closeDialog}
        targetPath={currentDirectoryPath}
        onUploadComplete={() => {
          onRefetch();
          dispatch({ type: "CLOSE" });
        }}
      />
      <DownloadOptionsDialog
        open={activeDialog?.type === "downloadOptions"}
        onOpenChange={closeDialog}
        paths={activeDialog?.type === "downloadOptions" ? activeDialog.paths : []}
        defaultArchiveName={activeDialog?.type === "downloadOptions" ? activeDialog.defaultName : ""}
        downloadMethods={workspaceDownload}
      />
      <DeleteConfirmDialog
        open={activeDialog?.type === "delete"}
        onOpenChange={closeDialog}
        isDeleting={activeDialog?.type === "delete" && isDialogLoading}
        pendingDeleteSelection={activeDialog?.type === "delete" ? activeDialog.items : []}
        nonEmptyFolderPathsInDelete={activeDialog?.type === "delete" ? activeDialog.nonEmptyPaths : []}
        onConfirmDelete={onConfirmDelete}
      />
      <FileViewerConstructionDialog
        open={activeDialog?.type === "fileViewerConstruction"}
        onOpenChange={closeDialog}
      />
    </>
  );
}
