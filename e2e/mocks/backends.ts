import { test as base, type Page, type Route } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

export interface JsonOverrideBodyContext {
  /** Parsed JSON request body (null when the body was not JSON or was empty). */
  parsedBody: unknown;
  /** 0-based count of how many times this override has been served on the current page. */
  callIndex: number;
}

export interface JsonOverride {
  url: string | RegExp;
  method?: string;
  status?: number;
  /**
   * Response body. Static value, or a function that receives `{ parsedBody, callIndex }` and
   * returns the body for that call — used when a single mock needs to evolve between calls
   * (e.g. a workspace listing that gains a new row after an upload completes).
   */
  body?: unknown | ((ctx: JsonOverrideBodyContext) => unknown);
  headers?: Record<string, string>;
  /**
   * Optional predicate against the parsed JSON request body. Lets multiple overrides share the
   * same URL and HTTP method (e.g. a single JSON-RPC endpoint that dispatches many methods).
   * If parsing fails, the predicate receives `null`.
   */
  matchBody?: (body: unknown) => boolean;
}

export interface BackendMockOptions {
  har?: string;
  overrides?: JsonOverride[];
  /** When true (default), any unmocked request to a backend host or /api/** fails the test. */
  strict?: boolean;
}

// Per-page log of backend requests the strict guard aborted. Populated inside the
// strict route handler and drained by verifyNoUnmockedBackendRequests() — which the
// custom `test` fixture below calls on teardown.
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

function isBackendRequest(requestUrl: string, appHost: string | undefined): boolean {
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
  if (override.method && override.method.toUpperCase() !== method.toUpperCase()) return false;
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
 * Apply backend mocks to a Playwright page.
 *
 * Playwright route handlers run LIFO (last registered is matched first). To make overrides and
 * HAR replay actually serve requests, we must register the strict catch-all FIRST, then HAR,
 * then overrides. That way overrides win, then HAR fills gaps, and strict only fires if nothing
 * else matched.
 *
 * With `strict: true` (default), every unmocked request to a backend host or the app's /api/**
 * namespace is aborted AND recorded on the page. Import `test` from this module (instead of
 * `@playwright/test`) to get automatic leak verification on teardown — the custom `page` fixture
 * calls `verifyNoUnmockedBackendRequests` after each test. The route handler itself cannot fail
 * the test because Playwright swallows thrown errors in route callbacks.
 *
 * Non-backend requests (Next.js assets, fonts, CDN) pass through unchanged regardless of strict
 * mode.
 */
export async function applyBackendMocks(page: Page, options: BackendMockOptions = {}): Promise<void> {
  const { har, overrides = [], strict = true } = options;
  const appHost = resolveAppHost();

  // 1. Strict guard — registered FIRST so it runs LAST (routes are LIFO).
  //    Only fires for backend requests that none of the later handlers matched.
  //    Aborts + records to the per-page log; verifyNoUnmockedBackendRequests throws later.
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
      console.warn(`[applyBackendMocks/strict] aborting unmocked backend request: ${record}`);
      await route.abort("failed");
    });
  }

  // 2. HAR replay — registered SECOND so it runs between overrides (above) and strict (below).
  //    `notFound: "fallback"` lets uncovered requests fall through to overrides then strict.
  if (har) {
    const harPath = path.isAbsolute(har) ? har : path.resolve(process.cwd(), "e2e/fixtures/hars", har);
    if (!fs.existsSync(harPath)) {
      throw new Error(
        `HAR file not found: ${harPath}. Record it first with \`pnpm e2e:record ${path.basename(har, ".har")}\`.`,
      );
    }
    await page.routeFromHAR(harPath, {
      url: /.*/,
      update: false,
      notFound: "fallback",
    });
  }

  // 3. Overrides — registered LAST so they run FIRST. These win over HAR and strict.
  if (overrides.length > 0) {
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
      const override = overrides.find((o) =>
        matchesOverride(o, request.url(), request.method(), parsedBody),
      );
      if (!override) {
        await route.fallback();
        return;
      }
      const counter = counterFor(override);
      const resolvedBody =
        typeof override.body === "function"
          ? (override.body as (ctx: JsonOverrideBodyContext) => unknown)({
              parsedBody,
              callIndex: counter.value,
            })
          : override.body;
      counter.value += 1;
      await route.fulfill({
        status: override.status ?? 200,
        contentType: "application/json",
        headers: override.headers ?? {},
        body: typeof resolvedBody === "string" ? resolvedBody : JSON.stringify(resolvedBody ?? {}),
      });
    });
  }
}

/**
 * Snapshot of backend requests the strict guard aborted for this page.
 * Empty array when strict was enabled but nothing leaked; empty array when strict was disabled.
 */
export function getUnmockedBackendRequests(page: Page): string[] {
  return [...(unmockedBackendRequests.get(page) ?? [])];
}

/**
 * Throws if any unmocked backend request reached the strict guard during the test.
 *
 * The `test` exported from this module already calls this automatically in its `page` fixture
 * teardown, so suites that `import { test } from "../mocks/backends"` do not need to call it
 * manually. Use it directly only when the default Playwright `test` is in play (e.g. the strict
 * self-tests in `backends.spec.ts`).
 *
 * The route handler cannot fail the test — Playwright swallows thrown errors in route callbacks
 * and logs them instead. Throwing during fixture teardown is what actually fails the test.
 */
export function verifyNoUnmockedBackendRequests(page: Page): void {
  const leaks = unmockedBackendRequests.get(page);
  if (!leaks || leaks.length === 0) return;
  const list = leaks.map((r) => `  - ${r}`).join("\n");
  unmockedBackendRequests.set(page, []);
  throw new Error(
    `applyBackendMocks/strict: ${leaks.length} unmocked backend request(s) leaked during this test:\n${list}`,
  );
}

/**
 * Playwright `test` extended with a `page` fixture that verifies no unmocked backend requests
 * leaked once the test finishes. Import this (and `expect`) from here in any suite that uses
 * `applyBackendMocks`, instead of `@playwright/test`:
 *
 *     import { test, expect } from "../mocks/backends";
 *
 * If the suite never calls `applyBackendMocks` (or calls it with `strict: false`), the
 * `unmockedBackendRequests` WeakMap has no entry for the page and the teardown is a no-op.
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await runTest(page);
    verifyNoUnmockedBackendRequests(page);
  },
});

export { expect } from "@playwright/test";

export const bvbrcCookies = [
  { name: "bvbrc_token", value: "e2e-test-token", path: "/", domain: "127.0.0.1" },
  { name: "bvbrc_user_id", value: "e2e-test-user@patricbrc.org", path: "/", domain: "127.0.0.1" },
  { name: "bvbrc_realm", value: "patricbrc.org", path: "/", domain: "127.0.0.1" },
  {
    name: "user_profile",
    value: encodeURIComponent(
      JSON.stringify({
        id: "e2e-test-user@patricbrc.org",
        email: "e2e@example.com",
        first_name: "E2E",
        last_name: "User",
      }),
    ),
    path: "/",
    domain: "127.0.0.1",
  },
  { name: "user_id", value: "e2e-test-user@patricbrc.org", path: "/", domain: "127.0.0.1" },
];
