"use client";

import { useEffect } from "react";
import { toast, useSonner } from "sonner";

export const errorToastDurationMs = 10_000;

/**
 * Keeps error toasts up long enough to read, with a close button. The
 * <Toaster> duration (3 s) suits success messages, but sonner has no per-type
 * default, so error toasts that set no duration of their own are updated in
 * place here. Render it next to the app's <Toaster>.
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
