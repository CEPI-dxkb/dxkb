"use client";

/**
 * PROTOTYPE — throwaway. Four folder-picker designs behind `?variant=A|B|C|D`
 * (A is the shipped dialog and the default). See `NOTES.md` in this folder.
 */

import {
  PrototypeSwitcher,
  usePrototypeVariant,
} from "@/components/shared/prototype-switcher";
import type { FolderPickerVariantProps } from "./types";
import { VariantA } from "./variant-a-current";
import { VariantB } from "./variant-b-columns";
import { VariantC } from "./variant-c-popover";
import { VariantD } from "./variant-d-sheet-tree";

export const folderPickerVariants = [
  { key: "A", name: "Current dialog" },
  { key: "B", name: "Finder columns" },
  { key: "C", name: "Inline popover" },
  { key: "D", name: "Side sheet tree" },
] as const;

export function FolderPickerPrototypes(props: FolderPickerVariantProps) {
  const variant = usePrototypeVariant(folderPickerVariants);
  switch (variant) {
    case "B":
      return <VariantB {...props} />;
    case "C":
      return <VariantC {...props} />;
    case "D":
      return <VariantD {...props} />;
    default:
      return <VariantA {...props} />;
  }
}

export function FolderPickerPrototypeSwitcher() {
  return <PrototypeSwitcher variants={folderPickerVariants} />;
}
