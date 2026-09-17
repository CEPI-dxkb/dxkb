import { NextRequest } from "next/server";

const testCookies = new Map<string, string>();

export const testCookieStore = {
  get: vi.fn((name: string) => {
    const value = testCookies.get(name);
    return value === undefined ? undefined : { name, value };
  }),
  set: vi.fn((name: string, value: string, _options?: unknown) => {
    if (value) testCookies.set(name, value);
    else testCookies.delete(name);
  }),
};

export function clearTestCookies(): void {
  testCookies.clear();
  testCookieStore.get.mockClear();
  testCookieStore.set.mockClear();
}

export function setTestSession({
  token = "test-token",
  userId = "testuser",
  realm,
}: {
  token?: string;
  userId?: string;
  realm?: string;
} = {}): void {
  testCookies.set("bvbrc_token", token);
  testCookies.set("bvbrc_user_id", userId);
  if (realm) testCookies.set("bvbrc_realm", realm);
  else testCookies.delete("bvbrc_realm");
}

/**
 * Factory for creating mock NextRequest objects for route handler tests.
 */
export function mockNextRequest(
  opts: {
    method?: string;
    url?: string;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const {
    method = "GET",
    url: baseUrl = "http://localhost:3019/api/test",
    body,
    rawBody,
    headers = {},
    searchParams,
  } = opts;

  let finalUrl = baseUrl;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    finalUrl = `${baseUrl}?${params.toString()}`;
  }

  const init: Record<string, unknown> = {
    method,
    headers:
      body !== undefined && rawBody === undefined && method !== "GET"
        ? { "Content-Type": "application/json", ...headers }
        : headers,
  };

  if (method !== "GET") {
    if (rawBody !== undefined) init.body = rawBody;
    else if (body !== undefined) init.body = JSON.stringify(body);
  }

  return new NextRequest(finalUrl, init);
}


/**
 * Builds the `{ params: Promise<…> }` second argument an App Router route
 * handler receives, typed to whatever params the route actually declares.
 *
 * Takes the params object rather than a bare `id` so a route segmented on
 * something else (`{ resource }` for `/api/data/[resource]`, `{ operation }`
 * for `/api/taxonomy-tree/[operation]`) uses this helper instead of
 * hand-rolling `{ params: Promise.resolve(…) }`. The generic preserves the
 * literal key type, so passing the wrong param name is a type error rather
 * than an `undefined` at runtime. Values may be `string[]` for a catch-all
 * segment and `undefined` for an optional one (`[[...path]]`), which is what
 * Next actually hands a handler.
 *
 * This is for **route handlers** only. A Page or `generateMetadata` receives
 * `{ params, searchParams }` — a different shape, usually with a second
 * promise — so the page specs under `src/app/(views)/**` build their props
 * directly and are not callers of this.
 */
export function makeRouteContext<
  T extends Record<string, string | string[] | undefined>,
>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
