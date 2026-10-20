/**
 * Server-side calls behind Similar Genome Finder: the MinHash distance search
 * and the genome details that name its hits.
 *
 * The Server Action (`similar-genome-finder/actions.ts`) and the
 * `/api/services/minhash` route both call these directly. The action used to
 * loop back over HTTP to this app's own API routes, which needed an extra
 * `INTERNAL_API_ORIGIN` setting and sent its name to the user when it was
 * missing.
 *
 * Network failures and spent budgets throw `UpstreamError` (from
 * `fetchUpstream`), with a message that names the service and host.
 */

import { parse } from "csv-parse/sync";

import {
  describeUpstreamResponse,
  fetchUpstream,
  upstreamResponseError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";

/**
 * A setting the search needs is missing. Its message names the variable, for
 * the server log only: callers show `userMessage` instead.
 */
export class MinhashConfigurationError extends Error {
  readonly userMessage =
    "Similar Genome Finder is unavailable right now: the search service is not configured on this server.";

  constructor(variable: string) {
    super(`Similar Genome Finder needs ${variable}, which is not set.`);
    this.name = "MinhashConfigurationError";
  }
}

/** The MinHash service answered, but with an error of its own. */
export class MinhashServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MinhashServiceError";
    this.status = status;
  }
}

function requireSetting(variable: string): string {
  const value = process.env[variable];
  if (!value) throw new MinhashConfigurationError(variable);
  return value;
}

/** The `error` a MinHash body carries, as text; null when it has none. */
export function minhashBodyError(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const err = (body as Record<string, unknown>).error;
  if (err == null || err === "" || err === false) return null;
  if (typeof err === "string") return err;
  if (typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return JSON.stringify(err);
}

export type MinhashServiceResponse =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * POSTs a JSON-RPC body to the MinHash service and returns its answer as the
 * `/api/services/minhash` route forwards it: the parsed JSON body, or, for a
 * non-OK answer, its status with the JSON error body (`{error, …}`) or an
 * `{error}` describing an HTML or empty one.
 */
export async function callMinhashService(
  body: object,
  token: string,
): Promise<MinhashServiceResponse> {
  const serviceUrl = requireSetting("MINHASH_SERVICE_URL");
  const response = await fetchUpstream(
    serviceUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
    },
    { service: upstreamServices.minhash, timeoutMs: upstreamTimeoutMs.minhash },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // An HTML error page: described from its status and title below.
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const data = parsed as Record<string, unknown>;
      return {
        ok: false,
        status: response.status,
        body: { error: data.error ?? "Minhash service error", ...data },
      };
    }
    return {
      ok: false,
      status: response.status,
      body: {
        error: describeUpstreamResponse(response, text, upstreamServices.minhash)
          .message,
      },
    };
  }

  return {
    ok: true,
    body: (await response.json()) as Record<string, unknown>,
  };
}

/**
 * Runs a MinHash search and returns its JSON-RPC result body. Throws
 * `MinhashServiceError` when the service answers with an error (non-OK, or an
 * `error` in an OK body), `UpstreamError` when it cannot be reached or does
 * not answer in time, and `MinhashConfigurationError` when the service URL is
 * not set.
 */
export async function searchMinhash(
  payload: object,
  token: string,
): Promise<Record<string, unknown>> {
  const answer = await callMinhashService(payload, token);
  const error = minhashBodyError(answer.body);
  if (!answer.ok) {
    throw new MinhashServiceError(
      error ?? "Minhash service request failed",
      answer.status,
    );
  }
  if (error) throw new MinhashServiceError(error, 200);
  return answer.body;
}

const maxGenomeDetailRows = 25_000;

function escapeSolrTerm(value: string): string {
  return value.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

function stringifyRecord(record: unknown): Record<string, string> {
  if (!record || typeof record !== "object") return {};
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).map(([key, value]) => [
      key,
      value !== null && value !== undefined
        ? String(value as string | number | boolean)
        : "",
    ]),
  );
}

function parseGenomeCsv(text: string): Record<string, string>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return parse<Record<string, string>>(trimmed, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

/**
 * Genome records (`genome_id`, `genome_name`, `organism_name`, …) for the
 * given IDs from the BV-BRC genome API, every value as a string. Throws
 * `UpstreamError` when the API fails or does not answer in time.
 */
export async function fetchMinhashGenomeDetails(
  genomeIds: string[],
  token: string,
): Promise<Record<string, string>[]> {
  const terms = genomeIds.reduce<string[]>((ids, id) => {
    const trimmed = id.trim();
    if (trimmed) ids.push(`"${escapeSolrTerm(trimmed)}"`);
    return ids;
  }, []);
  if (terms.length === 0) return [];

  const websiteApi = requireSetting("BVBRC_WEBSITE_API_URL");
  const formBody = new URLSearchParams({
    rows: String(Math.min(maxGenomeDetailRows, terms.length)),
    q: `genome_id:(${terms.join(" OR ")})`,
  });
  const response = await fetchUpstream(
    `${websiteApi}/genome/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/solrquery+x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: token,
      },
      body: formBody.toString(),
    },
    { service: upstreamServices.dataApi, timeoutMs: upstreamTimeoutMs.dataApi },
  );
  if (!response.ok) {
    throw await upstreamResponseError(response, upstreamServices.dataApi);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("application/json")) {
    const data = JSON.parse(text) as
      | unknown[]
      | { items?: unknown[]; results?: unknown[] };
    const records = Array.isArray(data)
      ? data
      : (data.items ?? data.results ?? []);
    return records.map(stringifyRecord);
  }
  return parseGenomeCsv(text).map(stringifyRecord);
}
