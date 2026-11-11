"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  maxCopilotAttachments,
  readCopilotAttachment,
  type CopilotAttachment,
} from "@/lib/copilot/attachments";
import {
  copilotDraftKey,
  copilotDraftSignal,
  emptyCopilotDraft,
  readCopilotDraft,
  restoreCopilotDraft,
  subscribeToCopilotDrafts,
  takeCopilotDraft,
  updateCopilotDraft,
  type CopilotDraft,
  type CopilotDraftContent,
} from "@/lib/copilot/drafts";
import type { CopilotExecutionMode } from "@/lib/copilot/types";

const emptyContent: CopilotDraftContent = { text: "", attachments: [] };

/** `key` is captured so a file lands in the chat it was added to; a result read after an account change is dropped. */
async function attachToCopilotDraft(key: string, files: File[]): Promise<void> {
  const signal = copilotDraftSignal();
  const { attachments, pendingReads } = readCopilotDraft(key);
  const room = Math.max(maxCopilotAttachments - attachments.length - pendingReads, 0);
  if (files.length > room) {
    toast.error(
      `Up to ${String(maxCopilotAttachments)} files can go with a question.`,
    );
  }
  const accepted = files.slice(0, room);
  if (accepted.length === 0) return;
  updateCopilotDraft(key, (draft) => ({
    ...draft,
    pendingReads: draft.pendingReads + accepted.length,
  }));

  const read = await Promise.all(
    accepted.map((file) =>
      readCopilotAttachment(file).catch((error: unknown) => ({
        error: `${file.name}: ${error instanceof Error ? error.message : "could not be read."}`,
      })),
    ),
  );
  if (signal.aborted) return;

  const added: CopilotAttachment[] = [];
  for (const entry of read) {
    if ("error" in entry) toast.error(entry.error);
    else added.push(entry.attachment);
  }
  updateCopilotDraft(key, (draft) => ({
    ...draft,
    attachments: [...draft.attachments, ...added].slice(0, maxCopilotAttachments),
    pendingReads: Math.max(draft.pendingReads - accepted.length, 0),
  }));
}

export function useCopilotDraft(username: string | null, sessionId: string | null) {
  const key =
    username !== null && sessionId !== null
      ? copilotDraftKey(username, sessionId)
      : null;
  const draft: CopilotDraft = useSyncExternalStore(
    subscribeToCopilotDrafts,
    () => (key === null ? emptyCopilotDraft : readCopilotDraft(key)),
    // The store is only written from event handlers, so server render and hydration start empty.
    () => emptyCopilotDraft,
  );

  return {
    text: draft.text,
    attachments: draft.attachments,
    reading: draft.pendingReads > 0,
    mode: draft.mode,
    setText: (text: string) => {
      if (key !== null) updateCopilotDraft(key, (current) => ({ ...current, text }));
    },
    setMode: (mode: CopilotExecutionMode | null) => {
      if (key !== null) updateCopilotDraft(key, (current) => ({ ...current, mode }));
    },
    attach: (files: File[]): Promise<void> =>
      key === null ? Promise.resolve() : attachToCopilotDraft(key, files),
    remove: (id: string) => {
      if (key === null) return;
      updateCopilotDraft(key, (current) => ({
        ...current,
        attachments: current.attachments.filter((item) => item.id !== id),
      }));
    },
    take: (): CopilotDraftContent =>
      key === null ? emptyContent : takeCopilotDraft(key),
    /** Targets this render's chat, not whichever is open when the send ends. */
    restore: (content: CopilotDraftContent, signal: AbortSignal): boolean =>
      key !== null && restoreCopilotDraft(key, content, signal),
  };
}
