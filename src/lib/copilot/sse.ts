/**
 * The chat stream is a POST, so `EventSource` cannot open it. Frames can be split anywhere across
 * chunks, lines may end in CRLF, and the gateway interleaves comment lines (`: heartbeat`).
 */

export interface SseFrame {
  event: string;
  data: string;
}

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

/** An abort of `signal` ends the iteration even when the body does not end on abort. */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let finished = false;
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
    // Not awaited: a cancel can wait on the source, and the consumer is done.
    if (finished) reader.releaseLock();
    else reader.cancel().catch(() => undefined);
  }
}
