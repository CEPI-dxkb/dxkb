import { DataRepositoryError } from "../client";
import { startNativeDownload } from "../download-transport";
import type { DownloadRequest } from "../downloads";

const request: DownloadRequest = {
  format: "tsv",
  scope: { kind: "query", rql: "eq(genome_status,Complete)" },
  sort: { field: "genome_name", direction: "asc" },
  fileNameBase: "genome",
  total: 20_000,
};

/** What the transport put in the page, read while its form is submitting. */
interface Submitted {
  form: HTMLFormElement;
  iframe: HTMLIFrameElement;
  sent: DownloadRequest & { nonce: string };
}

let submitted: Submitted | undefined;

beforeEach(() => {
  submitted = undefined;
  // jsdom does not navigate, so the submit itself is the observation point.
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (
    this: HTMLFormElement,
  ) {
    const iframe = document.querySelector<HTMLIFrameElement>(
      `iframe[name="${this.target}"]`,
    );
    const field = this.elements.namedItem("request") as HTMLInputElement;
    if (!iframe) throw new Error("the form must target a mounted iframe");
    submitted = {
      form: this,
      iframe,
      sent: JSON.parse(field.value) as Submitted["sent"],
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.cookie = "dxkb-download=; Path=/; Max-Age=0";
  document.body.replaceChildren();
});

function currentSubmission(): Submitted {
  if (!submitted) throw new Error("no form was submitted");
  return submitted;
}

/** The gateway answering `body` into a submission's iframe. */
function answer(iframe: HTMLIFrameElement, body: unknown): void {
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) throw new Error("the iframe must have a document");
  frameDocument.body.textContent = JSON.stringify(body);
  iframe.dispatchEvent(new Event("load"));
}

const throttled = {
  error: "Too many downloads. Please try again shortly.",
  code: "rate_limited",
};

describe("startNativeDownload", () => {
  it("posts the request with a nonce from a hidden form into a hidden iframe", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome_feature", request);

    const { form, iframe, sent } = currentSubmission();
    expect(form.method).toBe("post");
    expect(new URL(form.action).pathname).toBe(
      "/api/data/genome_feature/download",
    );
    expect(form.target).toBe(iframe.name);
    expect(form.hidden).toBe(true);
    expect(iframe.hidden).toBe(true);
    const { nonce, ...rest } = sent;
    expect(rest).toEqual(request);
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    // The token is never in the page: the session cookie carries it server-side.
    expect(JSON.stringify(sent)).not.toMatch(/token|authorization/i);

    // Settled, so neither its poll nor its timeout outlives the test.
    document.cookie = `dxkb-download=${nonce}; Path=/`;
    await vi.advanceTimersByTimeAsync(500);
    await expect(done).resolves.toBeUndefined();
  });

  it("resolves once the gateway's nonce cookie appears, and cleans up", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request, {
      pollIntervalMs: 100,
      cleanupDelayMs: 1_000,
    });
    const { form, iframe, sent } = currentSubmission();
    let settled = false;
    void done.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(false);

    document.cookie = `dxkb-download=${sent.nonce}; Path=/`;
    await vi.advanceTimersByTimeAsync(100);
    await expect(done).resolves.toBeUndefined();
    expect(form.isConnected).toBe(false);
    // The cookie is spent, and the frame outlives the start of the transfer.
    expect(document.cookie).not.toContain(sent.nonce);
    expect(iframe.isConnected).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(iframe.isConnected).toBe(false);
  });

  it("ignores another download's nonce", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request, {
      pollIntervalMs: 100,
      timeoutMs: 10_000,
    });
    let settled = false;
    void done.then(() => {
      settled = true;
    });

    document.cookie = "dxkb-download=someoneelse0000; Path=/";
    await vi.advanceTimersByTimeAsync(500);
    expect(settled).toBe(false);
  });

  it("rejects with the gateway's own message when the iframe receives an error", async () => {
    const done = startNativeDownload("genome", request);
    const { iframe } = currentSubmission();
    const frameDocument = iframe.contentDocument;
    if (!frameDocument) throw new Error("the iframe must have a document");

    frameDocument.body.textContent = JSON.stringify({
      error: "Over 2,500,000 rows: narrow the filters.",
      code: "invalid_request",
    });
    iframe.dispatchEvent(new Event("load"));

    const error: unknown = await done.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DataRepositoryError);
    expect(error).toMatchObject({
      message: "Over 2,500,000 rows: narrow the filters.",
      code: "invalid_request",
    });
    expect(iframe.isConnected).toBe(false);
  });

  it("submits a throttled download again after the gateway's retryAfterMs, with a fresh nonce", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request, { pollIntervalMs: 100 });
    const first = currentSubmission();

    answer(first.iframe, { ...throttled, retryAfterMs: 5_000 });
    expect(first.iframe.isConnected).toBe(false);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(currentSubmission()).toBe(first);

    await vi.advanceTimersByTimeAsync(1);
    const second = currentSubmission();
    expect(second).not.toBe(first);
    expect(second.sent.nonce).not.toBe(first.sent.nonce);
    document.cookie = `dxkb-download=${second.sent.nonce}; Path=/`;
    await vi.advanceTimersByTimeAsync(100);
    await expect(done).resolves.toBeUndefined();
  });

  it("backs off without a retryAfterMs, and gives up after three retries", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request);
    const caught = done.catch((error: unknown) => error);

    for (const backoffMs of [1_000, 2_000, 4_000]) {
      const attempt = currentSubmission();
      answer(attempt.iframe, throttled);
      await vi.advanceTimersByTimeAsync(backoffMs - 1);
      expect(currentSubmission()).toBe(attempt);
      await vi.advanceTimersByTimeAsync(1);
      expect(currentSubmission()).not.toBe(attempt);
    }
    answer(currentSubmission().iframe, throttled);

    const error = await caught;
    expect(error).toBeInstanceOf(DataRepositoryError);
    expect(error).toMatchObject({
      message: throttled.error,
      status: 429,
      code: "rate_limited",
    });
  });

  it("shows a non-JSON error body as it came", async () => {
    const done = startNativeDownload("genome", request);
    const { iframe } = currentSubmission();
    const frameDocument = iframe.contentDocument;
    if (!frameDocument) throw new Error("the iframe must have a document");

    frameDocument.body.textContent = "502 Bad Gateway";
    iframe.dispatchEvent(new Event("load"));

    await expect(done).rejects.toThrow("502 Bad Gateway");
  });

  it("ignores the blank document's own load", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request, {
      pollIntervalMs: 100,
    });
    const { iframe, sent } = currentSubmission();

    iframe.dispatchEvent(new Event("load"));
    document.cookie = `dxkb-download=${sent.nonce}; Path=/`;
    await vi.advanceTimersByTimeAsync(100);

    await expect(done).resolves.toBeUndefined();
  });

  it("gives up quietly when nothing reports back, leaving the frame", async () => {
    vi.useFakeTimers();
    const done = startNativeDownload("genome", request, { timeoutMs: 2_000 });
    const { iframe } = currentSubmission();

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(done).resolves.toBeUndefined();
    // A slow upstream may still start the file into it.
    expect(iframe.isConnected).toBe(true);
  });
});
