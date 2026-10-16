import { encodePathSegment } from "@/lib/url";
import { DataRepositoryError, retryRateLimited } from "./client";
import { downloadNonceCookie, type DownloadRequest } from "./downloads";
import type { DataResource } from "./types";

/**
 * The native download path: a hidden form POSTs the request to the same-origin
 * gateway into a hidden iframe, so the browser's download manager streams the
 * attachment straight to disk, as legacy BV-BRC does, and no `Blob` holds a
 * multi-gigabyte file in the tab. `DataRepository.download()` is the buffered
 * path for everything up to `maxBufferedDownloadRows` that is not whole
 * contigs; `useCollectionDownload` picks between the two (`usesNativeDownload`).
 *
 * A form cannot read its response, so two side channels report back:
 *
 * - **Started.** The gateway echoes the request's random nonce in the
 *   `dxkb-download` cookie on its success headers. The cookie appearing means
 *   the browser has the file; it is polled every 500 ms.
 * - **Failed.** An error is answered as text into the same-origin iframe,
 *   where its `{error}` message is read back and thrown, so the caller can
 *   show the server's own words. A `rate_limited` answer is submitted again,
 *   with a fresh nonce, after the `retryAfterMs` the gateway copies into the
 *   body from its `Retry-After` (`retryRateLimited`, as the buffered path).
 *
 * Neither arriving within 30 s is not an error: a slow upstream may still
 * start the file, so the promise resolves quietly and the iframe stays.
 */

export interface NativeDownloadOptions {
  basePath?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** How long the iframe outlives a download the browser has taken. */
  cleanupDelayMs?: number;
}

function createNonce(): string {
  // `getRandomValues`, unlike `randomUUID`, exists outside a secure context.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function hasNonceCookie(nonce: string): boolean {
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${downloadNonceCookie}=${nonce}`);
}

function clearNonceCookie(): void {
  document.cookie = `${downloadNonceCookie}=; Path=/; Max-Age=0; SameSite=Strict`;
}

/**
 * The error the gateway wrote into the iframe, or `null` while it holds
 * nothing (the initial `about:blank` document also fires `load`).
 */
function iframeError(iframe: HTMLIFrameElement): Error | null {
  const text = (iframe.contentDocument?.body.textContent ?? "").trim();
  if (!text) return null;
  try {
    const payload: unknown = JSON.parse(text);
    if (payload && typeof payload === "object") {
      const { error, code, retryAfterMs } = payload as {
        error?: unknown;
        code?: unknown;
        retryAfterMs?: unknown;
      };
      if (typeof error === "string") {
        // The frame hides the status, but the code names a 429.
        const rateLimited = code === "rate_limited";
        return new DataRepositoryError(
          error,
          rateLimited ? 429 : 0,
          typeof code === "string" ? code : "request_failed",
          rateLimited && typeof retryAfterMs === "number" && retryAfterMs >= 0
            ? retryAfterMs
            : undefined,
        );
      }
    }
  } catch {
    // Not the gateway's JSON (a proxy's error page, say): show its text.
  }
  return new Error(text.slice(0, 500));
}

/**
 * Submit `request` as a native form POST. Resolves once the browser has taken
 * the file (or after the quiet timeout), and rejects with the gateway's
 * message when it answers an error; a throttled request is retried first.
 */
export function startNativeDownload(
  resource: DataResource,
  request: DownloadRequest,
  options: NativeDownloadOptions = {},
): Promise<void> {
  return retryRateLimited(() => submitOnce(resource, request, options));
}

/** One attempt: its own nonce, form and iframe. */
function submitOnce(
  resource: DataResource,
  request: DownloadRequest,
  {
    basePath = "/api/data",
    pollIntervalMs = 500,
    timeoutMs = 30_000,
    cleanupDelayMs = 60_000,
  }: NativeDownloadOptions,
): Promise<void> {
  const nonce = createNonce();
  const iframe = document.createElement("iframe");
  iframe.name = `dxkb-download-${nonce}`;
  iframe.title = "Download";
  iframe.hidden = true;
  iframe.tabIndex = -1;
  const form = document.createElement("form");
  form.method = "post";
  form.action = `${basePath}/${encodePathSegment(resource)}/download`;
  form.target = iframe.name;
  form.acceptCharset = "utf-8";
  form.hidden = true;
  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "request";
  field.value = JSON.stringify({ ...request, nonce });
  form.append(field);

  return new Promise((resolve, reject) => {
    // Both callbacks run on a later task, by when `finish` exists.
    const poll = setInterval(() => {
      if (hasNonceCookie(nonce)) finish("started");
    }, pollIntervalMs);
    const timeout = setTimeout(() => {
      finish("timeout");
    }, timeoutMs);
    let settled = false;
    const finish = (outcome: "started" | "timeout" | Error) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      form.remove();
      if (outcome instanceof Error) {
        iframe.remove();
        reject(outcome);
        return;
      }
      if (outcome === "started") {
        clearNonceCookie();
        // The download manager owns the transfer by now, but give it time
        // before the frame that started it goes.
        setTimeout(() => {
          iframe.remove();
        }, cleanupDelayMs);
      }
      resolve();
    };

    document.body.append(iframe);
    iframe.addEventListener("load", () => {
      const error = iframeError(iframe);
      if (error) finish(error);
    });
    document.body.append(form);
    form.submit();
  });
}
