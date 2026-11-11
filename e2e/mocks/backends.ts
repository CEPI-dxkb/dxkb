import { test as base, type Page, type Route } from "@playwright/test";

export interface JsonOverrideBodyContext {
  parsedBody: unknown;
  callIndex: number;
  requestUrl: string;
  method: string;
}

/**
 * `object` rather than `Record<string, unknown>` so typed literals without an
 * index signature satisfy it without casts.
 */
export type JsonOverrideBody =
  | object
  | string
  | number
  | boolean
  | null
  | ((ctx: JsonOverrideBodyContext) => unknown);

export interface JsonOverride {
  url: string | RegExp;
  method?: string;
  status?: number;
  /**
   * Static value, or a function of `{ parsedBody, callIndex }` for mocks that
   * change between calls.
   */
  body?: JsonOverrideBody;
  headers?: Record<string, string>;
  matchBody?: (body: unknown) => boolean;
  contentType?: string;
  /**
   * Lets the request through to the app's own route handler so the
   * server-side path answers; `body`, `status` and `contentType` are ignored.
   */
  passthrough?: boolean;
}

export interface BackendMockOptions {
  overrides?: JsonOverride[];
  strict?: boolean;
}

// Earlier overrides win (first match wins), so a test can replace an entry by
// listing its own first.
const defaultOverrides: JsonOverride[] = [
  {
    url: "/api/services/app-service/jobs/summary",
    method: "POST",
    body: { taskSummary: {}, appSummary: {} },
  },
  {
    url: "/api/services/app-service/jobs/task-summary",
    method: "POST",
    body: { summary: {} },
  },
];

// WeakMap so entries are GC'd when Playwright retires the page.
const unmockedBackendRequests = new WeakMap<Page, string[]>();

const backendHostPattern =
  /^https?:\/\/([a-z0-9-]+\.)*(patricbrc\.org|bv-brc\.org|theseed\.org|ncbi\.nlm\.nih\.gov)(\/|$)/i;

function resolveAppHost(): string | undefined {
  const port = process.env.E2E_PORT ?? "3020";
  const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
  try {
    return new URL(baseURL).host;
  } catch {
    return undefined;
  }
}

function isInternalApi(url: URL, appHost: string | undefined): boolean {
  if (!appHost) return url.pathname.startsWith("/api/");
  return url.host === appHost && url.pathname.startsWith("/api/");
}

function isBackendRequest(
  requestUrl: string,
  appHost: string | undefined,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }
  if (backendHostPattern.test(requestUrl)) return true;
  return isInternalApi(parsed, appHost);
}

function matchesOverride(
  override: JsonOverride,
  requestUrl: string,
  method: string,
  parsedBody: unknown,
): boolean {
  if (override.method && override.method.toUpperCase() !== method.toUpperCase())
    return false;
  if (typeof override.url === "string") {
    if (!requestUrl.includes(override.url)) return false;
  } else if (!override.url.test(requestUrl)) {
    return false;
  }
  if (override.matchBody && !override.matchBody(parsedBody)) return false;
  return true;
}

function parseJsonBody(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Playwright routes run LIFO, so the strict catch-all is registered first and
 * overrides last. Throwing in a route callback cannot fail the test, so leaks
 * are verified in the custom `test` fixture's teardown.
 */
export async function applyBackendMocks(
  page: Page,
  options: BackendMockOptions = {},
): Promise<void> {
  const { overrides = [], strict = true } = options;
  const effectiveOverrides = [...overrides, ...defaultOverrides];
  const appHost = resolveAppHost();

  // Registered first so it runs last (routes are LIFO).
  if (strict) {
    unmockedBackendRequests.set(page, []);
    await page.route("**/*", async (route: Route) => {
      const url = route.request().url();
      if (!isBackendRequest(url, appHost)) {
        await route.fallback();
        return;
      }
      const record = `${route.request().method()} ${url}`;
      unmockedBackendRequests.get(page)?.push(record);
      console.warn(
        `[applyBackendMocks/strict] aborting unmocked backend request: ${record}`,
      );
      await route.abort("failed");
    });
  }

  // Registered last so they run first.
  if (effectiveOverrides.length > 0) {
    const callCounts = new WeakMap<JsonOverride, { value: number }>();
    const counterFor = (o: JsonOverride) => {
      let counter = callCounts.get(o);
      if (!counter) {
        counter = { value: 0 };
        callCounts.set(o, counter);
      }
      return counter;
    };
    await page.route("**/*", async (route: Route) => {
      const request = route.request();
      const parsedBody = parseJsonBody(request.postData());
      const override = effectiveOverrides.find((o) =>
        matchesOverride(o, request.url(), request.method(), parsedBody),
      );
      if (!override) {
        await route.fallback();
        return;
      }
      if (override.passthrough) {
        await route.continue();
        return;
      }
      const counter = counterFor(override);
      const bodyFn =
        typeof override.body === "function"
          ? (override.body as (ctx: JsonOverrideBodyContext) => unknown)
          : null;
      const resolvedBody: unknown = bodyFn
        ? bodyFn({
            parsedBody,
            callIndex: counter.value,
            requestUrl: request.url(),
            method: request.method(),
          })
        : override.body;
      counter.value += 1;
      await route.fulfill({
        status: override.status ?? 200,
        contentType: override.contentType ?? "application/json",
        headers: override.headers ?? {},
        body:
          typeof resolvedBody === "string"
            ? resolvedBody
            : JSON.stringify(resolvedBody ?? {}),
      });
    });
  }
}

export function getUnmockedBackendRequests(page: Page): string[] {
  return [...(unmockedBackendRequests.get(page) ?? [])];
}

/**
 * The exported `test` already calls this on teardown; call it directly only
 * with the default Playwright `test`. It must throw here because Playwright
 * swallows errors thrown in route callbacks.
 */
export function verifyNoUnmockedBackendRequests(page: Page): void {
  const leaks = unmockedBackendRequests.get(page);
  if (!leaks || leaks.length === 0) return;
  const list = leaks.map((r) => `  - ${r}`).join("\n");
  unmockedBackendRequests.set(page, []);
  throw new Error(
    `applyBackendMocks/strict: ${String(leaks.length)} unmocked backend request(s) leaked during this test:\n${list}`,
  );
}

/**
 * Import `test` and `expect` from here instead of `@playwright/test` to get
 * leak verification on teardown.
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await runTest(page);
    verifyNoUnmockedBackendRequests(page);
  },
});

export { expect } from "@playwright/test";
