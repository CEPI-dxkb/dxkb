"use client";

import { useState } from "react";
import type { CompareRegionSettings } from "@/lib/compare-region/contract";
import {
  canApplyDraft,
  draftOf,
  draftToSettings,
  type SettingsDraft,
} from "@/lib/compare-region/settings-draft";

/**
 * Not reset when `applied` changes: the panel keys the bar by the query
 * identity, so a new query mounts a fresh draft.
 */
export function useCompareRegionSettings(
  applied: CompareRegionSettings,
  onApply: (settings: CompareRegionSettings) => void,
): {
  draft: SettingsDraft;
  update: (patch: Partial<SettingsDraft>) => void;
  canApply: boolean;
  apply: () => void;
} {
  const [draft, setDraft] = useState(() => draftOf(applied));
  return {
    draft,
    update: (patch) => {
      setDraft((current) => ({ ...current, ...patch }));
    },
    canApply: canApplyDraft(draft, applied),
    apply: () => {
      onApply(draftToSettings(draft));
    },
  };
}
