import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import type { MockInstance } from "vitest";
import { useCopilotDraft } from "@/hooks/copilot/use-copilot-draft";
import {
  readCopilotAttachment,
  type CopilotAttachment,
} from "@/lib/copilot/attachments";
import {
  clearCopilotDrafts,
  copilotDraftKey,
  copilotDraftSignal,
  readCopilotDraft,
} from "@/lib/copilot/drafts";

vi.mock("@/lib/copilot/attachments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/copilot/attachments")>()),
  readCopilotAttachment: vi.fn(),
}));

type ReadResult = Awaited<ReturnType<typeof readCopilotAttachment>>;

function textFile(name: string): File {
  return new File(["x"], name, { type: "text/plain" });
}

function attachmentFor(file: File): CopilotAttachment {
  return {
    id: `id-${file.name}`,
    kind: "file",
    name: file.name,
    size: file.size,
    content: "x",
    mimeType: "text/plain",
  };
}

function deferReads() {
  const pending = new Map<string, (result: ReadResult) => void>();
  vi.mocked(readCopilotAttachment).mockImplementation(
    (file) =>
      new Promise<ReadResult>((resolve) => {
        pending.set(file.name, resolve);
      }),
  );
  return {
    finish: async (file: File, result: ReadResult = { attachment: attachmentFor(file) }) => {
      await act(async () => {
        pending.get(file.name)?.(result);
        await Promise.resolve();
      });
    },
  };
}

function renderDraft(sessionId: string, username: string | null = "alice") {
  return renderHook(
    (props: { username: string | null; sessionId: string | null }) =>
      useCopilotDraft(props.username, props.sessionId),
    { initialProps: { username, sessionId } },
  );
}

let toastError: MockInstance<typeof toast.error>;

beforeEach(() => {
  toastError = vi.spyOn(toast, "error").mockImplementation(() => "toast");
});

afterEach(() => {
  toastError.mockRestore();
  clearCopilotDrafts();
});

describe("useCopilotDraft", () => {
  it("keeps each chat's draft apart and shows it again on return (C48)", async () => {
    const reads = deferReads();
    const notes = textFile("notes.txt");
    const { result, rerender } = renderDraft("s1");

    act(() => {
      result.current.setText("about s1");
    });
    let attaching: Promise<void> = Promise.resolve();
    act(() => {
      attaching = result.current.attach([notes]);
    });
    await reads.finish(notes);
    await act(() => attaching);
    expect(result.current.attachments.map((item) => item.name)).toEqual(["notes.txt"]);

    rerender({ username: "alice", sessionId: "s2" });
    expect(result.current.text).toBe("");
    expect(result.current.attachments).toEqual([]);

    rerender({ username: "alice", sessionId: "s1" });
    expect(result.current.text).toBe("about s1");
    expect(result.current.attachments.map((item) => item.name)).toEqual(["notes.txt"]);
  });

  it("puts a file read after a chat switch into the chat it was added to (C56)", async () => {
    const reads = deferReads();
    const notes = textFile("notes.txt");
    const { result, rerender } = renderDraft("s1");

    act(() => {
      void result.current.attach([notes]);
    });
    expect(result.current.reading).toBe(true);
    rerender({ username: "alice", sessionId: "s2" });
    expect(result.current.reading).toBe(false);

    await reads.finish(notes);
    expect(result.current.attachments).toEqual([]);
    rerender({ username: "alice", sessionId: "s1" });
    expect(result.current.attachments.map((item) => item.name)).toEqual(["notes.txt"]);
    expect(result.current.reading).toBe(false);
  });

  it("restores a taken draft into the chat it came from (C57)", () => {
    const { result, rerender } = renderDraft("s1");
    act(() => {
      result.current.setText("unsent question");
    });

    const fromS1 = result.current;
    const signal = copilotDraftSignal();
    const taken = fromS1.take();
    expect(taken.text).toBe("unsent question");
    rerender({ username: "alice", sessionId: "s2" });
    act(() => {
      fromS1.restore(taken, signal);
    });

    expect(result.current.text).toBe("");
    rerender({ username: "alice", sessionId: "s1" });
    expect(result.current.text).toBe("unsent question");
  });

  it("reserves room for reads in progress and blocks sending until they settle (A3-NEW-1)", async () => {
    const reads = deferReads();
    const [a, b, c, d] = ["a.txt", "b.txt", "c.txt", "d.txt"].map(textFile);
    const { result } = renderDraft("s1");

    act(() => {
      void result.current.attach([a, b]);
      void result.current.attach([c, d]);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Up to 3 files can go with a question.");
    expect(result.current.reading).toBe(true);

    await reads.finish(a);
    await reads.finish(b);
    expect(result.current.reading).toBe(true);
    await reads.finish(c);

    expect(result.current.reading).toBe(false);
    expect(result.current.attachments.map((item) => item.name)).toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
    ]);
    expect(readCopilotAttachment).toHaveBeenCalledTimes(3);
  });

  it("names a file that could not be read, keeping its message", async () => {
    const reads = deferReads();
    const big = textFile("big.txt");
    const { result } = renderDraft("s1");

    act(() => {
      void result.current.attach([big]);
    });
    await reads.finish(big, { error: "big.txt is larger than 10 MB." });

    expect(toastError).toHaveBeenCalledWith("big.txt is larger than 10 MB.");
    expect(result.current.attachments).toEqual([]);
    expect(result.current.reading).toBe(false);
  });

  it("drops a read that finishes after the account changed, without a toast (C47)", async () => {
    const reads = deferReads();
    const notes = textFile("notes.txt");
    const { result } = renderDraft("s1");

    act(() => {
      result.current.setText("alice's question");
      void result.current.attach([notes]);
    });
    act(() => {
      clearCopilotDrafts();
    });
    expect(result.current.text).toBe("");
    expect(result.current.reading).toBe(false);

    await reads.finish(notes, { error: "notes.txt looks like a binary file." });
    expect(toastError).not.toHaveBeenCalled();
    expect(readCopilotDraft(copilotDraftKey("alice", "s1")).attachments).toEqual([]);
    expect(result.current.reading).toBe(false);
  });

  it("is the empty draft, and ignores changes, without a user or a chat", () => {
    const { result } = renderDraft("s1", null);
    act(() => {
      result.current.setText("ignored");
      result.current.setMode("execute");
      void result.current.attach([textFile("a.txt")]);
    });
    expect(result.current.text).toBe("");
    expect(result.current.mode).toBeNull();
    expect(result.current.attachments).toEqual([]);
    expect(result.current.take()).toEqual({ text: "", attachments: [] });
    expect(readCopilotAttachment).not.toHaveBeenCalled();
  });

  it("keeps the chat's Plan/Execute choice and removes one attachment", async () => {
    const reads = deferReads();
    const [a, b] = ["a.txt", "b.txt"].map(textFile);
    const { result } = renderDraft("s1");

    act(() => {
      result.current.setMode("execute");
      void result.current.attach([a, b]);
    });
    await reads.finish(a);
    await reads.finish(b);
    act(() => {
      result.current.remove("id-a.txt");
    });

    expect(result.current.mode).toBe("execute");
    expect(result.current.attachments.map((item) => item.name)).toEqual(["b.txt"]);
  });
});
