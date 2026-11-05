/**
 * Server-Sent Events read from a `fetch` body. The chat stream is a POST, so
 * `EventSource` (GET only) cannot open it.
 *
 * The gateway writes `event: <name>\ndata: <one-line JSON>\n\n`, plus comment
 * lines (`: connected`, `: heartbeat`) to keep the connection open. Frames can
 * be split anywhere across chunks, and lines may end in `\r\n`.
 */

export interface SseFrame {
  /** `message` when the frame names no event, as the SSE spec defines. */
  event: string;
  /** The frame's `data:` lines joined with `\n`. */
  data: string;
}

/**
 * Parses frames from decoded text pushed in arbitrary pieces. `push` returns
 * the frames completed by that piece; `flush` returns a final frame the stream
 * ended without a blank line after.
 */
export function createSseParser() {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  function take(): SseFrame | null {
    if (data.length === 0) {
      event = "";
      return null;
    }
    const frame = { event: event || "message", data: data.join("\n") };
    event = "";
    data = [];
    return frame;
  }

  function line(raw: string): SseFrame | null {
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (text === "") return take();
    if (text.startsWith(":")) return null;
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    return null;
  }

  return {
    push(chunk: string): SseFrame[] {
      buffer += chunk;
      const frames: SseFrame[] = [];
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const frame = line(buffer.slice(0, newline));
        if (frame) frames.push(frame);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      return frames;
    },
    flush(): SseFrame | null {
      if (buffer !== "") {
        line(buffer);
        buffer = "";
      }
      return take();
    },
  };
}

/**
 * Every frame of a byte stream, in order. An abort of `signal` ends the
 * iteration even when the body itself does not end on abort.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let finished = false;
  // Cancelling resolves a pending read as done, which ends the loop below.
  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal?.aborted) return;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield* parser.push(decoder.decode(value, { stream: true }));
    }
    finished = true;
    yield* parser.push(decoder.decode());
    const last = parser.flush();
    if (last) yield last;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    // A consumer that stops early (a `done` event, Stop) closes the stream
    // rather than leaving the connection open behind a released lock. Not
    // awaited: a cancel can wait on the source, and the consumer is done.
    if (finished) reader.releaseLock();
    else reader.cancel().catch(() => undefined);
  }
}
