import fs from "node:fs";
import path from "node:path";

import type { JsonOverride } from "../mocks/backends";

interface HarHeader {
  name: string;
  value: string;
}

interface HarEntry {
  request: {
    url: string;
    method: string;
    postData?: { text?: string };
  };
  response: {
    status?: number;
    headers?: HarHeader[];
    content?: { text?: string; encoding?: string };
  };
}

interface HarFile {
  log: { entries: HarEntry[] };
}

// Drop session-bearing headers when promoting HAR responses into overrides.
// `record-har.ts` already strips these from the request side at sanitize time,
// but the response side carries the recorder's own runtime headers (e.g.
// Set-Cookie from the dev server, Authentication-Info on some BV-BRC paths)
// that would otherwise leak into the replayed response.
const sensitiveHeaders = new Set([
  "set-cookie",
  "cookie",
  "authorization",
  "proxy-authorization",
  "authentication-info",
  "x-auth-token",
  "x-api-key",
]);

/**
 * Pull the JSON-RPC `method` field out of a request body, or null if the body
 * is empty / non-JSON / lacks a string-typed `method` field. The override
 * mechanism's `matchBody` predicate uses this to fan a single endpoint
 * (`/api/services/workspace`) out to the four-plus JSON-RPC methods that
 * share it.
 */
function extractRpcMethod(body: string | null | undefined): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as { method?: unknown }).method === "string"
    ) {
      return (parsed as { method: string }).method;
    }
  } catch {
    // non-JSON request body (e.g. multipart upload) — no RPC method to extract
  }
  return null;
}

/**
 * Reduce a fully-qualified URL to `pathname + search` so HAR matching is
 * port-portable. The recorder rewrites the live origin to a placeholder host
 * (`http://e2e-har-replay.local`), and specs run against `E2E_PORT` (default
 * 3020) — matching on the URL host would constantly mis-match. The override
 * matcher does a `requestUrl.includes(override.url)` substring check, and a
 * raw `pathname + search` is a valid suffix of any qualified request URL.
 */
function urlToPathSearch(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function pickHeaders(headers: HarHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers ?? []) {
    if (!sensitiveHeaders.has(header.name.toLowerCase())) {
      out[header.name] = header.value;
    }
  }
  return out;
}

interface GroupedEntries {
  rpcMethod: string | null;
  pathSearch: string;
  method: string;
  entries: HarEntry[];
}

/**
 * Read a HAR file and return JSON overrides that replay each recorded entry.
 *
 * Entries are grouped by `{path+search, HTTP method, JSON-RPC method?}`. Each
 * group becomes a single override:
 *
 *  - The override URL is the path+search portion of the recorded URL, so port
 *    differences between the recorder (3010) and the live spec (E2E_PORT)
 *    don't break matching.
 *  - When the request body is a JSON-RPC envelope, `matchBody` ensures only
 *    requests carrying that RPC method are served by this override. This
 *    closes the routeFromHAR gap: routeFromHAR matches URL+method only, so
 *    four different JSON-RPC calls to `/api/services/workspace` would all
 *    serve the first matching response.
 *  - When a group has multiple entries (e.g. two `Workspace.ls` calls before
 *    and after an upload), responses are served in HAR order via the
 *    override's `callIndex` body function. Once the recorded sequence is
 *    exhausted, the last entry is served on every subsequent call so the UI
 *    isn't suddenly mocked off the air.
 *
 * Status and response headers are taken from the first entry in each group;
 * if a journey needs status drift across calls, layer hand-rolled overrides
 * on top of the HAR-derived ones in the spec.
 *
 * Pass the result into `applyBackendMocks(page, { overrides })`. The return
 * value is a plain `JsonOverride[]`, so callers can spread additional
 * fixture-specific overrides before or after for behaviour the recorder
 * couldn't capture (empty list, 500 response, etc.).
 *
 * @param harPath  Absolute path or relative-to-CWD path; relative paths
 *                 resolve from `e2e/fixtures/hars/`.
 */
export function harOverridesFor(harPath: string): JsonOverride[] {
  const resolvedPath = path.isAbsolute(harPath)
    ? harPath
    : path.resolve(process.cwd(), "e2e/fixtures/hars", harPath);

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const har = JSON.parse(raw) as HarFile;

  const groupOrder: string[] = [];
  const groups = new Map<string, GroupedEntries>();
  for (const entry of har.log.entries) {
    const rpcMethod = extractRpcMethod(entry.request.postData?.text);
    const pathSearch = urlToPathSearch(entry.request.url);
    const method = entry.request.method.toUpperCase();
    const key = `${method} ${pathSearch} ${rpcMethod ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = { rpcMethod, pathSearch, method, entries: [] };
      groups.set(key, group);
      groupOrder.push(key);
    }
    group.entries.push(entry);
  }

  return groupOrder.map((key): JsonOverride => {
    // Non-null: every key in `groupOrder` was just inserted above.
    const group = groups.get(key) as GroupedEntries;
    const first = group.entries[0];
    const headers = pickHeaders(first.response.headers);
    const bodies = group.entries.map((e) => e.response.content?.text ?? "");

    const override: JsonOverride = {
      url: group.pathSearch,
      method: group.method,
      status: first.response.status ?? 200,
      headers,
      body:
        bodies.length === 1
          ? bodies[0]
          : ({ callIndex }) => bodies[Math.min(callIndex, bodies.length - 1)],
    };

    if (group.rpcMethod !== null) {
      const expected = group.rpcMethod;
      override.matchBody = (body) =>
        body !== null &&
        typeof body === "object" &&
        (body as { method?: unknown }).method === expected;
    }

    return override;
  });
}
