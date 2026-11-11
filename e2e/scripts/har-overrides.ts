import fs from "node:fs";
import path from "node:path";

import type { JsonOverride, JsonOverrideBodyContext } from "../mocks/backends";

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

// Drops session-bearing response headers (Set-Cookie, Authentication-Info)
// the recorder's own server added.
const sensitiveHeaders = new Set([
  "set-cookie",
  "cookie",
  "authorization",
  "proxy-authorization",
  "authentication-info",
  "x-auth-token",
  "x-api-key",
]);

// Hop-by-hop and body-shape headers (RFC 7230 §6.1) describe the original
// wire bytes, which `route.fulfill` re-serializes.
const transportHeaders = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "content-length",
  "content-encoding",
]);

interface RpcRequest {
  method: string;
  params: unknown;
}

function parseRpcRequest(body: string | null | undefined): RpcRequest | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as { method?: unknown }).method === "string"
    ) {
      const obj = parsed as { method: string; params?: unknown };
      return { method: obj.method, params: obj.params };
    }
  } catch {
    // unparseable body: no match
  }
  return null;
}

/**
 * Path + search only, so matching survives the recorder's placeholder host
 * and any `E2E_PORT`.
 */
function urlToPathSearch(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function resolveHarPath(harPath: string): string {
  return path.isAbsolute(harPath)
    ? harPath
    : path.resolve(process.cwd(), "e2e/fixtures/hars", harPath);
}

// Memoized per process so repeated reads do not re-parse a multi-MB file.
const parsedHarCache = new Map<string, HarFile>();

function loadHar(harPath: string): HarFile {
  const resolved = resolveHarPath(harPath);
  let har = parsedHarCache.get(resolved);
  if (!har) {
    har = JSON.parse(fs.readFileSync(resolved, "utf8")) as HarFile;
    parsedHarCache.set(resolved, har);
  }
  return har;
}

function pickHeaders(headers: HarHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers ?? []) {
    const lower = header.name.toLowerCase();
    if (sensitiveHeaders.has(lower) || transportHeaders.has(lower)) continue;
    out[header.name] = header.value;
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
 * Groups entries by path+search, HTTP method and JSON-RPC method; repeated
 * calls replay in HAR order via `callIndex`, then the last entry repeats.
 * Canary journeys must not layer a broad aggregate over this, or HAR drift
 * would be silently served instead of failing the strict guard.
 */
export function harOverridesFor(harPath: string): JsonOverride[] {
  const har = loadHar(harPath);

  const groupOrder: string[] = [];
  const groups = new Map<string, GroupedEntries>();
  for (const entry of har.log.entries) {
    const rpcMethod =
      parseRpcRequest(entry.request.postData?.text)?.method ?? null;
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
          : ({ callIndex }: JsonOverrideBodyContext) =>
              bodies[Math.min(callIndex, bodies.length - 1)],
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

/**
 * Basename of the uploaded file, from the `Workspace.create` call;
 * re-recordings use a fresh timestamped name.
 */
export function uploadedFilenameFromHar(harPath: string): string {
  const har = loadHar(harPath);

  for (const entry of har.log.entries) {
    const rpc = parseRpcRequest(entry.request.postData?.text);
    if (rpc?.method !== "Workspace.create") continue;
    if (!Array.isArray(rpc.params)) continue;
    const first = rpc.params[0] as { objects?: unknown[] } | undefined;
    if (!first || !Array.isArray(first.objects)) continue;
    const obj: unknown = first.objects[0];
    if (!Array.isArray(obj) || typeof obj[0] !== "string") continue;
    const basename = obj[0].split("/").pop();
    if (basename) return basename;
  }

  throw new Error(
    `No Workspace.create entry with an object path found in ${harPath}`,
  );
}
