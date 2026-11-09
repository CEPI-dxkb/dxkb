"use client";

import dynamic from "next/dynamic";

// The picker (columns, preview, upload form, listing hooks) loads when it is
// first opened, so the service forms, collections and chat that offer Browse
// do not carry it in their first bundle. Import it from here, never from
// `./folder-picker-dialog`, which would put it back.
export const WorkspaceFolderPickerDialog = dynamic(
  () =>
    import("./folder-picker-dialog").then(
      (module) => module.WorkspaceFolderPickerDialog,
    ),
  { ssr: false },
);

/**
 * Starts loading the picker before it opens (pointer over or focus on a Browse
 * button), so the first click rarely waits for it. A failed load is left to the
 * render, which reports it.
 */
export function preloadFolderPickerDialog(): void {
  import("./folder-picker-dialog").catch(() => undefined);
}
