/**
 * Maps a failed server-side BV-BRC call to the status, code and message a route answers with.
 * Messages name the service and cause, never the host; the host rides on `host` for server logs.
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
  host?: string;
  source?: string;
}

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: UpstreamFailureCode;
  /** `declare` emits no field, so an error without a host has no `host` key. */
  declare readonly host?: string;
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

export const upstreamServices = {
  dataApi: "the BV-BRC data service",
  workspace: "the BV-BRC workspace service",
  jobService: "the BV-BRC job service",
  fileStorage: "the BV-BRC file storage service",
  minhash: "the BV-BRC minhash service",
  compareRegion: "the BV-BRC compare region service",
  copilot: "the BV-BRC Copilot service",
} as const;

/** Budgets bound the wait for a service that accepts the connection and never answers; they sit above each service's slow successes. */
export const upstreamTimeoutMs = {
  dataApi: 20_000,
  /** Override for `genome_amr`: the taxon join is slow while Solr's caches are cold. */
  dataApiGenomeAmr: 60_000,
  /** Override for `genome_feature`: Solr's uncached cross-collection join took 109–125 s for Influenza A; kept under undici's 300 s headers timeout. */
  dataApiGenomeFeature: 150_000,
  workspace: 30_000,
  jobService: 30_000,
  fileStorage: 30_000,
  minhash: 60_000,
  /** compare_regions pins homologs in every compared genome first: 72 s for 50 genomes. */
  compareRegion: 120_000,
  /** Bounds only the wait for headers; a chat turn streams through with `streamBody`. */
  copilot: 30_000,
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
const maxScannedBodyLength = 20_000;

function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

// Matched by name: an abort's DOMException can come from another realm (jsdom), where instanceof fails.
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

/** undici puts the socket error in `cause`; a dual-stack connect failure is an `AggregateError` with one failure per address in `errors`. */
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
  timeoutMs?: number;
  host?: string;
}

function withHost(
  failure: UpstreamFailure,
  host: string | undefined,
): UpstreamFailure {
  return host ? { ...failure, host } : failure;
}

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

/** Returns `null` for a caller's own `AbortError` and ordinary application errors. */
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
    // The innermost message is the specific one; the outer one is only "fetch failed".
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

/** The readable part of an upstream error body, never markup. */
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
    // non-JSON body: fall through
  }
  return condense(text);
}

export interface UpstreamResponseLike {
  status: number;
  statusText?: string;
  headers?: Headers;
}

/** Callers owning a more specific 4xx wording keep theirs and use this only for 5xx. */
export function describeUpstreamResponse(
  response: UpstreamResponseLike,
  body: string,
  service: string,
  options: { host?: string } = {},
): UpstreamFailure {
  // Trailing punctuation is dropped so the detail does not end in "soon.).".
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
  service: string;
  timeoutMs: number;
  /** Bounds only the wait for headers, for bodies the caller streams (file downloads). */
  streamBody?: boolean;
  fetcher?: typeof fetch;
}

/** Capped by `E2E_UPSTREAM_BUDGET_MS` only when `E2E_MOCK_ENABLED=1`, so a hang outage does not sit out a production budget. */
function e2eBudgetMs(timeoutMs: number): number {
  if (process.env.E2E_MOCK_ENABLED !== "1") return timeoutMs;
  const cap = Number(process.env.E2E_UPSTREAM_BUDGET_MS);
  return Number.isFinite(cap) && cap > 0 ? Math.min(timeoutMs, cap) : timeoutMs;
}

/** `fetch` bounded by `timeoutMs`, composed with `init.signal`. Throws `UpstreamError` on failure; a caller's own abort rethrows untouched. */
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
