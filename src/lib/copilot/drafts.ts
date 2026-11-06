/**
 * What the user has typed and attached for each chat's next question, kept
 * outside React so the side panel, the floating window and the `/copilot`
 * page show the same draft, and switching chats shows that chat's own.
 *
 * Only the Copilot panel's chunk and the `/copilot` page load this module
 * (never the auth provider or the sign-out paths), and it registers its clear
 * with `registerAccountCacheClear`, so an account change empties it. Keys
 * also carry the username, which keeps accounts apart on a path that never
 * calls `clearAccountCaches()` (signing in from another tab).
 */
import { registerAccountCacheClear } from "@/lib/account-caches";
import type { CopilotAttachment } from "./attachments";
import type { CopilotExecutionMode } from "./types";

export interface CopilotDraft {
  text: string;
  attachments: CopilotAttachment[];
  /** Files still being read for this draft; their room is reserved. */
  pendingReads: number;
  /**
   * Plan/Execute picked in this chat, or null for the mode the session
   * stored (a new chat saves it with its first question).
   */
  mode: CopilotExecutionMode | null;
}

/** What a send takes from the draft, and gives back if it was not sent. */
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

/** The draft under `key`: the stored object, so snapshots stay stable. */
export function readCopilotDraft(key: string): CopilotDraft {
  return drafts.get(key) ?? emptyCopilotDraft;
}

/** Replaces the draft under `key`; one that comes back empty is deleted. */
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

/**
 * Empties the draft's text and attachments for a send, and returns them. The
 * mode and any reads still running stay.
 */
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
 * Gives a send's text and attachments back to the draft it took them from,
 * when that send did not go out. Only an empty draft is filled (nothing
 * typed, attached or being read since), and only while `signal`, taken
 * before the send, has not been aborted by an account change. True when it
 * was filled; otherwise the caller has to tell the user the question is gone.
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

/**
 * Aborted when the account changes. Work that writes into a draft later (a
 * file read, a send's restore) takes it first and drops its result once it
 * is aborted.
 */
export function copilotDraftSignal(): AbortSignal {
  return generation.signal;
}

/** Drops every draft and aborts the current account's signal. */
export function clearCopilotDrafts(): void {
  drafts.clear();
  generation.abort();
  generation = new AbortController();
  notify();
}

registerAccountCacheClear(clearCopilotDrafts);
