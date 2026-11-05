import { clearAccountCaches } from "@/lib/account-caches";
import type { CopilotAttachment } from "@/lib/copilot/attachments";
import {
  clearCopilotDrafts,
  copilotDraftKey,
  copilotDraftSignal,
  emptyCopilotDraft,
  readCopilotDraft,
  restoreCopilotDraft,
  subscribeToCopilotDrafts,
  takeCopilotDraft,
  updateCopilotDraft,
} from "@/lib/copilot/drafts";

const file: CopilotAttachment = {
  id: "f1",
  kind: "file",
  name: "notes.txt",
  size: 5,
  content: "hello",
  mimeType: "text/plain",
};

const aliceKey = copilotDraftKey("alice", "s1");

afterEach(() => {
  clearCopilotDrafts();
});

describe("copilot drafts", () => {
  it("keeps accounts and chats apart in the key", () => {
    expect(copilotDraftKey("alice", "s1")).not.toBe(copilotDraftKey("bob", "s1"));
    expect(copilotDraftKey("alice", "s1")).not.toBe(copilotDraftKey("alice", "s2"));
  });

  it("reads the empty draft, the same object each time, for a chat with none", () => {
    expect(readCopilotDraft(aliceKey)).toBe(emptyCopilotDraft);
    expect(readCopilotDraft(aliceKey)).toBe(readCopilotDraft(aliceKey));
    expect(Object.isFrozen(emptyCopilotDraft)).toBe(true);
  });

  it("returns the stored object until the draft changes, and notifies on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToCopilotDrafts(listener);
    updateCopilotDraft(aliceKey, (draft) => ({ ...draft, text: "hi" }));
    const stored = readCopilotDraft(aliceKey);
    expect(stored.text).toBe("hi");
    expect(readCopilotDraft(aliceKey)).toBe(stored);
    expect(listener).toHaveBeenCalledTimes(1);
    // An update that changes nothing notifies no one.
    updateCopilotDraft(aliceKey, (draft) => draft);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    updateCopilotDraft(aliceKey, (draft) => ({ ...draft, text: "bye" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("deletes a draft that is emptied", () => {
    updateCopilotDraft(aliceKey, (draft) => ({ ...draft, text: "hi" }));
    updateCopilotDraft(aliceKey, (draft) => ({ ...draft, text: "" }));
    expect(readCopilotDraft(aliceKey)).toBe(emptyCopilotDraft);
  });

  it("takes the text and attachments, and leaves the mode and running reads", () => {
    updateCopilotDraft(aliceKey, () => ({
      text: "question",
      attachments: [file],
      pendingReads: 1,
      mode: "execute",
    }));
    expect(takeCopilotDraft(aliceKey)).toEqual({ text: "question", attachments: [file] });
    expect(readCopilotDraft(aliceKey)).toEqual({
      text: "",
      attachments: [],
      pendingReads: 1,
      mode: "execute",
    });
  });

  it("restores into an empty draft only", () => {
    const signal = copilotDraftSignal();
    expect(
      restoreCopilotDraft(aliceKey, { text: "question", attachments: [file] }, signal),
    ).toBe(true);
    expect(readCopilotDraft(aliceKey)).toMatchObject({
      text: "question",
      attachments: [file],
    });

    // Typed since the send: kept as it is.
    updateCopilotDraft(aliceKey, (draft) => ({ ...draft, text: "newer", attachments: [] }));
    expect(
      restoreCopilotDraft(aliceKey, { text: "question", attachments: [file] }, signal),
    ).toBe(false);
    expect(readCopilotDraft(aliceKey)).toMatchObject({ text: "newer", attachments: [] });
  });

  it("empties every draft and aborts the signal when the account changes", () => {
    updateCopilotDraft(aliceKey, (draft) => ({
      ...draft,
      text: "alice's question",
      attachments: [file],
    }));
    const before = copilotDraftSignal();
    const listener = vi.fn();
    const unsubscribe = subscribeToCopilotDrafts(listener);

    clearAccountCaches();

    expect(readCopilotDraft(aliceKey)).toBe(emptyCopilotDraft);
    expect(before.aborted).toBe(true);
    expect(copilotDraftSignal().aborted).toBe(false);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("does not restore with a signal from before the account changed", () => {
    const before = copilotDraftSignal();
    clearAccountCaches();
    expect(
      restoreCopilotDraft(aliceKey, { text: "alice's question", attachments: [file] }, before),
    ).toBe(false);
    expect(readCopilotDraft(aliceKey)).toBe(emptyCopilotDraft);
  });
});
