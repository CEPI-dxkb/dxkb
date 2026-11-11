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

export function mockNextRequest(
  opts: {
    method?: string;
    url?: string;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): NextRequest {
  const {
    method = "GET",
    url: baseUrl = "http://localhost:3019/api/test",
    body,
    rawBody,
    headers = {},
    searchParams,
    signal,
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
    if (rawBody !== undefined) {
      init.body = rawBody;
      // Node's Request requires it for a stream body.
      if (rawBody instanceof ReadableStream) init.duplex = "half";
    } else if (body !== undefined) init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;

  return new NextRequest(finalUrl, init);
}


/** Builds the `{ params: Promise }` argument of a route handler (values may be `string[]` or `undefined`); not for pages. */
export function makeRouteContext<
  T extends Record<string, string | string[] | undefined>,
>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
