/**
 * Kept outside React so every surface shows the same draft. Only the panel chunk and `/copilot`
 * load this module, and it registers its clear with `registerAccountCacheClear`; keys carry the
 * username so accounts stay apart when signing in from another tab.
 */
import { registerAccountCacheClear } from "@/lib/account-caches";
import type { CopilotAttachment } from "./attachments";
import type { CopilotExecutionMode } from "./types";

export interface CopilotDraft {
  text: string;
  attachments: CopilotAttachment[];
  pendingReads: number;
  mode: CopilotExecutionMode | null;
}

export type CopilotDraftContent = Pick<CopilotDraft, "text" | "attachments">;

export const emptyCopilotDraft: Readonly<CopilotDraft> = Object.freeze({
  text: "",
  attachments: [],
  pendingReads: 0,
  mode: null,
});

const drafts = new Map<string, CopilotDraft>();
const listeners = new Set<() => void>();
let generation = new AbortController();

function isEmptyDraft(draft: CopilotDraft): boolean {
  return (
    draft.text === "" &&
    draft.attachments.length === 0 &&
    draft.pendingReads === 0 &&
    draft.mode === null
  );
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function copilotDraftKey(username: string, sessionId: string): string {
  return `${username}\n${sessionId}`;
}

export function readCopilotDraft(key: string): CopilotDraft {
  return drafts.get(key) ?? emptyCopilotDraft;
}

export function updateCopilotDraft(
  key: string,
  update: (draft: CopilotDraft) => CopilotDraft,
): void {
  const current = readCopilotDraft(key);
  const next = update(current);
  if (next === current) return;
  if (isEmptyDraft(next)) drafts.delete(key);
  else drafts.set(key, next);
  notify();
}

export function subscribeToCopilotDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function takeCopilotDraft(key: string): CopilotDraftContent {
  const { text, attachments } = readCopilotDraft(key);
  updateCopilotDraft(key, (draft) =>
    draft.text === "" && draft.attachments.length === 0
      ? draft
      : { ...draft, text: "", attachments: [] },
  );
  return { text, attachments };
}

/**
 * Fills only an empty draft, and only while `signal` (taken before the send) is not aborted; true
 * when filled, else the caller must tell the user the question is gone.
 */
export function restoreCopilotDraft(
  key: string,
  content: CopilotDraftContent,
  signal: AbortSignal,
): boolean {
  if (signal.aborted) return false;
  const draft = readCopilotDraft(key);
  if (
    draft.text !== "" ||
    draft.attachments.length > 0 ||
    draft.pendingReads > 0
  ) {
    return false;
  }
  updateCopilotDraft(key, (current) => ({
    ...current,
    text: content.text,
    attachments: content.attachments,
  }));
  return true;
}

/** Aborted when the account changes; later writers take it first and drop their result once aborted. */
export function copilotDraftSignal(): AbortSignal {
  return generation.signal;
}

export function clearCopilotDrafts(): void {
  drafts.clear();
  generation.abort();
  generation = new AbortController();
  notify();
}

registerAccountCacheClear(clearCopilotDrafts);
