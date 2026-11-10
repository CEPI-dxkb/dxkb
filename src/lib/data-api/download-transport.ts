import { encodePathSegment } from "@/lib/url";
import { DataRepositoryError, retryRateLimited } from "./client";
import { downloadNonceCookie, type DownloadRequest } from "./downloads";
import type { DataResource } from "./types";

/**
 * Native download: a hidden form POSTs to the gateway into a hidden iframe, so
 * the browser streams the file to disk.
 * A form cannot read its response, so the `dxkb-download` nonce cookie signals
 * start and an error answered as text into the iframe signals failure.
 * Neither arriving within 30 s is not an error: a slow upstream may still start
 * the file, so the promise resolves quietly.
 */

export interface NativeDownloadOptions {
  basePath?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
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
 * The initial `about:blank` document also fires `load`, so `null` means the
 * iframe holds nothing.
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

export function startNativeDownload(
  resource: DataResource,
  request: DownloadRequest,
  options: NativeDownloadOptions = {},
): Promise<void> {
  return retryRateLimited(() => submitOnce(resource, request, options));
}

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
        // before the frame goes.
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
