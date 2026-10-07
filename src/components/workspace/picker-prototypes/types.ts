/**
 * PROTOTYPE — throwaway. Contract every folder-picker variant implements. See
 * `NOTES.md` in this folder.
 */

import type { PickerSelectablePredicate } from "@/lib/services/workspace/picker-views";

export interface FolderPickerVariantProps {
  /** The field's current folder path ("" when unset). */
  value: string;
  /** Commit a folder path to the field. */
  onChange: (path: string) => void;
  /** The trigger must be disabled (field disabled or signed out). */
  disabled: boolean;
  /** Extra rule on top of "is a writable folder", e.g. no hidden folders. */
  isSelectable: PickerSelectablePredicate;
  /** e.g. "Select an Output Folder". */
  title: string;
}
