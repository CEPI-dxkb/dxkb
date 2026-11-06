import { createSseParser, readSseFrames, type SseFrame } from "../sse";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const frames: SseFrame[] = [];
  for await (const frame of readSseFrames(stream)) frames.push(frame);
  return frames;
}

describe("createSseParser", () => {
  it("reads named events and skips comment lines", () => {
    const parser = createSseParser();
    expect(
      parser.push(': connected\n\nevent: started\ndata: {"job_id":"j1"}\n\n: heartbeat\n\n'),
    ).toEqual([{ event: "started", data: '{"job_id":"j1"}' }]);
  });

  it("joins frames split across chunks, including inside a line", () => {
    const parser = createSseParser();
    expect(parser.push("event: final_resp")).toEqual([]);
    expect(parser.push('onse\ndata: {"chunk":"He')).toEqual([]);
    expect(parser.push('llo"}\n')).toEqual([]);
    expect(parser.push("\n")).toEqual([
      { event: "final_response", data: '{"chunk":"Hello"}' },
    ]);
  });

  it("accepts CRLF line endings and multi-line data", () => {
    const parser = createSseParser();
    expect(parser.push("data: one\r\ndata: two\r\n\r\n")).toEqual([
      { event: "message", data: "one\ntwo" },
    ]);
  });

  it("flushes a last frame the stream ended without a blank line after", () => {
    const parser = createSseParser();
    parser.push('event: done\ndata: {"job_id":"j1"}');
    expect(parser.flush()).toEqual({ event: "done", data: '{"job_id":"j1"}' });
    expect(parser.flush()).toBeNull();
  });
});

describe("readSseFrames", () => {
  it("yields every frame of a byte stream in order", async () => {
    await expect(
      collect(
        streamOf(
          ": connected\n\n",
          'event: progress\ndata: {"step_id":"s1"}\n\nevent: do',
          'ne\ndata: {}\n\n',
        ),
      ),
    ).resolves.toEqual([
      { event: "progress", data: '{"step_id":"s1"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"chunk":"α→β"}\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 17));
        controller.enqueue(bytes.slice(17));
        controller.close();
      },
    });
    await expect(collect(stream)).resolves.toEqual([
      { event: "message", data: '{"chunk":"α→β"}' },
    ]);
  });

  it("cancels the stream when the consumer stops early", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: a\n\ndata: b\n\n"));
      },
      cancel,
    });
    for await (const frame of readSseFrames(stream)) {
      expect(frame.data).toBe("a");
      break;
    }
    expect(cancel).toHaveBeenCalled();
  });
});

describe("readSseFrames with a signal", () => {
  it("ends when the signal aborts, even if the body never ends", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(source) {
        source.enqueue(new TextEncoder().encode("data: a\n\n"));
      },
    });
    const frames: SseFrame[] = [];
    for await (const frame of readSseFrames(stream, controller.signal)) {
      frames.push(frame);
      controller.abort();
    }
    expect(frames).toEqual([{ event: "message", data: "a" }]);
  });
});
