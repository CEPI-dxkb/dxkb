import { delay, HttpResponse } from "msw";

/**
 * Upstream failures as the server sees them, for MSW handlers.
 *
 * undici rejects a failed connection with `TypeError("fetch failed")` and the
 * socket error in `cause`. MSW rejects the intercepted `fetch` with a thrown
 * error as is when it looks like a Node error (`code` and `errno` present),
 * so a handler can `throw connectTimeout()` to reproduce the outage exactly.
 */
export function undiciFetchFailure(code: string, causeMessage: string): TypeError {
  const cause = Object.assign(new Error(causeMessage), { code });
  return Object.assign(new TypeError("fetch failed", { cause }), {
    code: undefined,
    errno: undefined,
  });
}

/** The 2026-10-19 outage: TCP connect to p3.theseed.org hung until undici gave up. */
export function connectTimeout(): TypeError {
  return undiciFetchFailure(
    "UND_ERR_CONNECT_TIMEOUT",
    "Connect Timeout Error (attempted address: p3.theseed.org:443, timeout: 10000ms)",
  );
}

export function connectionRefused(): TypeError {
  return undiciFetchFailure("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:443");
}

/** BV-BRC's maintenance page, as `user.bv-brc.org` and `www.bv-brc.org` served it. */
export const maintenancePageHtml = `<!doctype html>
<title>Site Maintenance</title>
<style>
  body { text-align: center; padding: 150px; }
  h1 { font-size: 50px; }
  body { font: 20px Helvetica, sans-serif; color: #333; }
  article { display: block; text-align: left; width: 650px; margin: 0 auto; }
</style>
<article>
    <h1>We&rsquo;ll be back soon!</h1>
    <div>
        <p>Sorry for the inconvenience. Service will be back soon.</p>
    </div>
</article>`;

export const maintenanceSummary = "Site Maintenance — We’ll be back soon!";

export function maintenancePage(status = 503): HttpResponse<string> {
  return new HttpResponse(maintenancePageHtml, {
    status,
    statusText: status === 503 ? "Service Unavailable" : "Internal Server Error",
    headers: { "Content-Type": "text/html" },
  });
}

/** A service that accepts the connection and never answers. */
export async function neverRespond(): Promise<never> {
  await delay("infinite");
  throw new Error("unreachable");
}

const realTimeout = AbortSignal.timeout.bind(AbortSignal);

/**
 * Lets every `AbortSignal.timeout` budget fire after `ms` while the code under
 * test still names its production budget in messages. Undo with
 * `vi.restoreAllMocks()`.
 */
export function shortenTimeouts(ms = 20): void {
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(ms));
}
