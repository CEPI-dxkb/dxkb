"use client";

import { useEffect } from "react";
import { toast, useSonner } from "sonner";

export const errorToastDurationMs = 10_000;

/**
 * sonner has no per-type default duration, so error toasts without their own
 * duration are updated in place here to stay up long enough to read.
 */
export function ErrorToastDefaults() {
  const { toasts } = useSonner();

  useEffect(() => {
    for (const shown of toasts) {
      if (shown.type !== "error" || shown.duration !== undefined) continue;
      toast.error(shown.title, {
        id: shown.id,
        duration: errorToastDurationMs,
        closeButton: shown.closeButton ?? true,
      });
    }
  }, [toasts]);

  return null;
}
