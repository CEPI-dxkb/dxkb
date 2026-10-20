/**
 * One mapping from "a server-side call to a BV-BRC backend failed" to the
 * status, code and message a route answers with.
 *
 * Without it every layer dropped the cause on its own: undici reports a
 * connect timeout as `TypeError: fetch failed` with the real reason in
 * `cause`, so a route that forwarded `error.message` told the user "fetch
 * failed", and one that did not said "Internal server error". A maintenance
 * page is HTML, so a route that forwarded the body printed page source.
 *
 * - `describeUpstreamFailure` reads a thrown network error (undici's
 *   `cause.code`, or the `TimeoutError` of an `AbortSignal.timeout`).
 * - `describeUpstreamResponse` reads a non-OK response, keeping only the
 *   `<title>`/`<h1>` text of an HTML body.
 * - `fetchUpstream` is `fetch` with a budget that throws `UpstreamError`
 *   carrying either description, and leaves a caller's own abort untouched.
 *
 * Messages name the service and the cause, never the host: which machine
 * answers for a service is deployment detail a user cannot act on. The host
 * rides along on `UpstreamFailure.host` (and `UpstreamError.host`), so a
 * route's `console.error` of the error still tells an operator which host is
 * down.
 */

import { noop } from "@/lib/utils";

export type UpstreamFailureCode =
  | "upstream_timeout"
  | "service_unavailable"
  | "upstream_error";

export interface UpstreamFailure {
  status: number;
  code: UpstreamFailureCode;
  message: string;
  /** The host that failed, for server logs only; never in `message`. */
  host?: string;
  /**
   * The request that failed, by its internal name ("genome isolation_country
   * facet"), for server logs only; never in `message`.
   */
  source?: string;
}

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: UpstreamFailureCode;
  /**
   * Printed by `console.error(error)`, which lists an error's own fields.
   * `declare` emits no field, so an error without a host has no `host` key.
   */
  declare readonly host?: string;
  /** Printed by `console.error(error)`, as `host` is. */
  declare readonly source?: string;

  constructor(failure: UpstreamFailure, options?: ErrorOptions) {
    super(failure.message, options);
    this.name = "UpstreamError";
    this.status = failure.status;
    this.code = failure.code;
    if (failure.host) this.host = failure.host;
    if (failure.source) this.source = failure.source;
  }
}

/** How failure messages name each backend (lower case, mid-sentence). */
export const upstreamServices = {
  dataApi: "the BV-BRC data service",
  workspace: "the BV-BRC workspace service",
  jobService: "the BV-BRC job service",
  fileStorage: "the BV-BRC file storage service",
  minhash: "the BV-BRC minhash service",
} as const;

/**
 * Per-service budgets for one upstream round trip. Each bounds the wait for a
 * service that accepts the connection and then never answers (undici's own
 * bound is a 300 s headers timeout); a host that refuses or drops the
 * connection already fails within undici's 10 s connect timeout.
 *
 * They sit above the slow-but-good responses each service is known for, so a
 * budget never turns a slow success into a failure.
 */
export const upstreamTimeoutMs = {
  /** Data API reads. Large facet queries take 5–15 s; the gateway's own 503 takes ~20 s. */
  dataApi: 20_000,
  /**
   * Data API reads of AMR phenotypes (`genome_amr`), a per-resource override of
   * `dataApi` that `ServerDataRepository` applies. A taxon's AMR tab joins
   * through `genome(...)`, and that join over every bacterial genome takes
   * well past `dataApi` while Solr's caches are cold (a phylum alone takes
   * ~11 s), then answers in 2–3 s once warm.
   */
  dataApiGenomeAmr: 60_000,
  /** Workspace JSON-RPC (a recursive `Workspace.ls` of a large home is the slow case). */
  workspace: 30_000,
  /** App service JSON-RPC, including `start_app2`, and job stdout/stderr. */
  jobService: 30_000,
  /** Time to the first byte of a Shock file; the body itself streams unbounded. */
  fileStorage: 30_000,
  /** Similar Genome Finder computes distances before it answers. */
  minhash: 60_000,
} as const;

const timeoutCodes = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ETIMEDOUT",
]);

const unreachableReasons: Record<string, string> = {
  ECONNREFUSED: "connection refused",
  ENOTFOUND: "host not found",
  EAI_AGAIN: "host lookup failed",
  ECONNRESET: "connection reset",
  EHOSTUNREACH: "host unreachable",
  ENETUNREACH: "network unreachable",
  EPIPE: "connection closed",
  UND_ERR_SOCKET: "connection closed",
  UND_ERR_CLOSED: "connection closed",
};

const maxDetailLength = 200;
// Bounds the regex work on a large error page; a title sits at the top.
const maxScannedBodyLength = 20_000;

function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

// Matched by name rather than instanceof: the DOMException an abort produces
// can come from another realm (jsdom in tests), where instanceof Error fails.
function errorName(error: unknown): string | undefined {
  const name = property(error, "name");
  return typeof name === "string" ? name : undefined;
}

function errorMessage(error: unknown): string | undefined {
  const message = property(error, "message");
  return typeof message === "string" && message.trim()
    ? message.trim()
    : undefined;
}

/**
 * The error and its causes, outermost first: undici puts the socket error in
 * `cause`, and a dual-stack connect failure is an `AggregateError` whose
 * `errors` hold one failure per address.
 */
function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && chain.length < 4 && !chain.includes(current)) {
    chain.push(current);
    const nested = property(current, "errors");
    if (Array.isArray(nested) && nested.length > 0) chain.push(nested[0]);
    current = property(current, "cause");
  }
  return chain;
}

function firstCode(chain: unknown[]): string | undefined {
  for (const link of chain) {
    const code = property(link, "code");
    if (typeof code === "string" && code) return code;
  }
  return undefined;
}

/**
 * The socket-level code behind a failure (`UND_ERR_CONNECT_TIMEOUT`,
 * `ECONNREFUSED`, …), searched through its causes.
 */
export function upstreamCauseCode(error: unknown): string | undefined {
  // An UpstreamError's own `code` is ours, not the socket's.
  let start: unknown = error;
  while (start instanceof UpstreamError) start = start.cause;
  return firstCode(causeChain(start));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function seconds(ms: number): string {
  return `${String(Math.round(ms / 100) / 10)} s`;
}

function condense(text: string, max = maxDetailLength): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max
    ? collapsed
    : `${collapsed.slice(0, max).trimEnd()}…`;
}

export function hostOf(input: string | URL | Request): string | undefined {
  try {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
    return url.host || undefined;
  } catch {
    return undefined;
  }
}

/** undici reports its connect budget only inside the message. */
function connectTimeoutMs(chain: unknown[]): number | undefined {
  for (const link of chain) {
    const match = /timeout:\s*(\d+)\s*ms/i.exec(errorMessage(link) ?? "");
    if (match) return Number(match[1]);
  }
  return undefined;
}

export interface DescribeFailureOptions {
  /** The budget whose `TimeoutError` this may be, for the message. */
  timeoutMs?: number;
  /** Carried on the failure for server logs; never part of the message. */
  host?: string;
}

/** `host` as an optional field, absent rather than `undefined`. */
function withHost(
  failure: UpstreamFailure,
  host: string | undefined,
): UpstreamFailure {
  return host ? { ...failure, host } : failure;
}

/** A spent budget: 504 "… did not respond (timed out after N s)". */
export function upstreamTimeoutFailure(
  service: string,
  options: DescribeFailureOptions = {},
): UpstreamFailure {
  const budget = options.timeoutMs ? ` after ${seconds(options.timeoutMs)}` : "";
  return withHost(
    {
      status: 504,
      code: "upstream_timeout",
      message: `${capitalize(service)} did not respond (timed out${budget}).`,
    },
    options.host,
  );
}

/**
 * Describes a thrown network-level failure, or returns `null` when `error` is
 * not one: a caller's own `AbortError` (which keeps its own handling, such as
 * the Data API's 499) and ordinary application errors are the caller's to
 * map.
 *
 * - a budget's `TimeoutError`, or an undici connect/headers/body timeout →
 *   504 `upstream_timeout`, "… did not respond (timed out after N s)"
 * - refused, reset, unresolvable or otherwise failed connections → 502
 *   `service_unavailable`, "Could not reach …: <reason>" (502 as a gateway
 *   answers an upstream it cannot connect to)
 */
export function describeUpstreamFailure(
  error: unknown,
  service: string,
  options: DescribeFailureOptions = {},
): UpstreamFailure | null {
  if (error instanceof UpstreamError) {
    return withHost(
      { status: error.status, code: error.code, message: error.message },
      error.host,
    );
  }
  const name = errorName(error);
  if (name === "AbortError") return null;

  if (name === "TimeoutError") return upstreamTimeoutFailure(service, options);

  const chain = causeChain(error);
  const code = firstCode(chain);

  if (code && timeoutCodes.has(code)) {
    const connectMs =
      code === "UND_ERR_CONNECT_TIMEOUT" ? connectTimeoutMs(chain) : undefined;
    const what =
      code === "UND_ERR_CONNECT_TIMEOUT"
        ? `connection timed out${connectMs ? ` after ${seconds(connectMs)}` : ""}`
        : code === "UND_ERR_BODY_TIMEOUT"
          ? "timed out while sending its response"
          : "timed out";
    return withHost(
      {
        status: 504,
        code: "upstream_timeout",
        message: `${capitalize(service)} did not respond (${what}).`,
      },
      options.host,
    );
  }

  const reason = code ? unreachableReasons[code] : undefined;
  const isFetchFailure =
    name === "TypeError" &&
    /fetch failed|failed to fetch|network/i.test(errorMessage(error) ?? "");
  if (reason || isFetchFailure) {
    // The innermost message is the specific one ("getaddrinfo ENOTFOUND …",
    // "unable to verify the first certificate"); the outer one is only
    // "fetch failed".
    const detail =
      reason ??
      chain
        .slice(1)
        .map(errorMessage)
        .filter((message): message is string => Boolean(message))
        .at(-1) ??
      code ??
      errorMessage(error);
    return withHost(
      {
        status: 502,
        code: "service_unavailable",
        message: `Could not reach ${service}${detail ? `: ${condense(detail)}` : ""}.`,
      },
      options.host,
    );
  }

  return null;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
    mdash: "—",
    ndash: "–",
    hellip: "…",
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number(body.slice(1)));
    return named[body.toLowerCase()] ?? entity;
  });
}

function htmlText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function isHtmlBody(body: string, contentType?: string | null): boolean {
  return /html/i.test(contentType ?? "") || /^\s*</.test(body);
}

/**
 * The readable part of an upstream error body, condensed, never markup:
 * an HTML page's `<title>` and first `<h1>` ("Site Maintenance — We’ll be
 * back soon!"), a JSON body's `error`/`message`, or the text itself.
 * Empty when the body says nothing.
 */
export function summarizeUpstreamBody(
  body: string,
  contentType?: string | null,
): string {
  const text = body.slice(0, maxScannedBodyLength);
  if (!text.trim()) return "";

  if (isHtmlBody(text, contentType)) {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1];
    const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text)?.[1];
    const parts = [title, heading]
      .map((part) => (part ? htmlText(part) : ""))
      .filter((part, index, all) => part && all.indexOf(part) === index);
    if (parts.length > 0) return condense(parts.join(" — "));
    const visible = htmlText(
      text.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, " "),
    );
    return condense(visible);
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const nested = property(parsed, "error");
    const message =
      [property(nested, "message"), nested, property(parsed, "message")].find(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      );
    if (message) return condense(message);
  } catch {
    // Not JSON: fall through to the text itself.
  }
  return condense(text);
}

export interface UpstreamResponseLike {
  status: number;
  statusText?: string;
  headers?: Headers;
}

/**
 * Describes a non-OK upstream response from its status and body text.
 *
 * - 503 → 503 `service_unavailable`; 504 → 504 `upstream_timeout`; any other
 *   5xx → 502 `upstream_error`, each "… is unavailable (HTTP 503 Service
 *   Unavailable: Site Maintenance)".
 * - 4xx keeps its status with "… rejected the request (HTTP 404 …)". Callers
 *   that own a more specific wording for a 4xx ("Authentication failed")
 *   keep theirs and use this only for 5xx.
 */
export function describeUpstreamResponse(
  response: UpstreamResponseLike,
  body: string,
  service: string,
  options: { host?: string } = {},
): UpstreamFailure {
  // Trailing sentence punctuation is dropped: the detail sits inside "(…)."
  // and "Service will be back soon." would otherwise end in "soon.).".
  const detail = summarizeUpstreamBody(
    body,
    response.headers?.get("content-type"),
  ).replace(/[.\s]+$/, "");
  const statusText = response.statusText?.trim();
  const label = `HTTP ${String(response.status)}${statusText ? ` ${statusText}` : ""}${detail && detail !== statusText ? `: ${detail}` : ""}`;
  const subject = capitalize(service);

  if (response.status >= 500) {
    const [status, code]: [number, UpstreamFailureCode] =
      response.status === 503
        ? [503, "service_unavailable"]
        : response.status === 504
          ? [504, "upstream_timeout"]
          : [502, "upstream_error"];
    return withHost(
      { status, code, message: `${subject} is unavailable (${label}).` },
      options.host,
    );
  }
  return withHost(
    {
      status: response.status,
      code: "upstream_error",
      message: `${subject} rejected the request (${label}).`,
    },
    options.host,
  );
}

export interface FetchUpstreamOptions {
  /** Lower-case service phrase for messages: "the BV-BRC workspace service". */
  service: string;
  timeoutMs: number;
  /**
   * Bound only the wait for the response headers. For a body the caller
   * streams through (a file download), which may legitimately take longer
   * than any budget.
   */
  streamBody?: boolean;
  fetcher?: typeof fetch;
}

/**
 * The budget `fetchUpstream` waits, which is `timeoutMs` everywhere but the
 * e2e harness. There the loopback mock's "hang" outage never answers, and a
 * spec would sit out a 20–60 s production budget, so `E2E_UPSTREAM_BUDGET_MS`
 * (`.env.e2e.test`) caps it. Read only when `E2E_MOCK_ENABLED=1`, the flag
 * that also guards the mock, so a deploy cannot shorten a budget by setting
 * one variable. Messages keep naming `timeoutMs`, the production budget.
 */
function e2eBudgetMs(timeoutMs: number): number {
  if (process.env.E2E_MOCK_ENABLED !== "1") return timeoutMs;
  const cap = Number(process.env.E2E_UPSTREAM_BUDGET_MS);
  return Number.isFinite(cap) && cap > 0 ? Math.min(timeoutMs, cap) : timeoutMs;
}

/**
 * `fetch` bounded by `options.timeoutMs`, composed with any `init.signal` so
 * the caller's own cancellation keeps working. A network failure or a spent
 * budget throws `UpstreamError` (with the original error as `cause`); the
 * caller's own abort rethrows untouched. The response is returned as is, OK or
 * not: reading a non-OK body is the caller's (see `describeUpstreamResponse`).
 *
 * Without `streamBody`, the budget also bounds reading the body, exactly as
 * `AbortSignal.timeout` on a plain `fetch` does.
 */
export async function fetchUpstream(
  input: string | URL,
  init: RequestInit,
  options: FetchUpstreamOptions,
): Promise<Response> {
  const timeout = AbortSignal.timeout(e2eBudgetMs(options.timeoutMs));
  let budget: AbortSignal = timeout;
  let release = noop;
  if (options.streamBody) {
    const controller = new AbortController();
    const onTimeout = () => {
      controller.abort(timeout.reason);
    };
    timeout.addEventListener("abort", onTimeout, { once: true });
    release = () => {
      timeout.removeEventListener("abort", onTimeout);
    };
    budget = controller.signal;
  }
  const callerSignal = init.signal ?? undefined;
  const signal = callerSignal ? AbortSignal.any([callerSignal, budget]) : budget;

  try {
    return await (options.fetcher ?? fetch)(input, { ...init, signal });
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    const failure = describeUpstreamFailure(error, options.service, {
      timeoutMs: options.timeoutMs,
      host: hostOf(input),
    });
    if (failure) throw new UpstreamError(failure, { cause: error });
    throw error;
  } finally {
    release();
  }
}

/** `describeUpstreamResponse` for a response `fetchUpstream` returned. */
export async function upstreamResponseError(
  response: Response,
  service: string,
): Promise<UpstreamError> {
  const body = await response.text().catch(() => "");
  return new UpstreamError(
    describeUpstreamResponse(response, body, service, {
      host: response.url ? hostOf(response.url) : undefined,
    }),
  );
}
