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
 * The command bar's draft of the settings, applied on Update only (as
 * legacy; one request can take a minute). The draft starts from `applied`
 * and is not reset when `applied` changes: the panel keys the bar by the
 * query identity, so a new query (Update, back/forward) mounts a fresh draft.
 */
export function useCompareRegionSettings(
  applied: CompareRegionSettings,
  onApply: (settings: CompareRegionSettings) => void,
): {
  draft: SettingsDraft;
  /** Patch one or more fields. */
  update: (patch: Partial<SettingsDraft>) => void;
  /** The draft changed and, for a group source, names a workspace group. */
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
