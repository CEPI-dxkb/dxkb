import { test, expect } from "@playwright/test";
import {
  applyBackendMocks,
  getUnmockedBackendRequests,
  verifyNoUnmockedBackendRequests,
  type JsonOverride,
} from "../mocks/backends";

/**
 * Self-tests for applyBackendMocks. Exercises precedence rules (overrides > HAR > strict),
 * strict-mode enforcement on backend hosts, and non-backend fallthrough for Next assets.
 *
 * Uses in-page fetch via page.evaluate so requests flow through page.route() (page.request
 * bypasses routing).
 */

interface FetchResult {
  status: number;
  ok: boolean;
  body: unknown;
}

// Narrow, serializable subset of RequestInit — Playwright's page.evaluate requires args to be
// JSON-safe, and the full RequestInit type (Headers, AbortSignal) is not.
interface SerializableRequestInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

async function inPageFetch(
  page: import("@playwright/test").Page,
  url: string,
  init?: SerializableRequestInit,
): Promise<FetchResult> {
  return page.evaluate(async (args: { url: string; init?: SerializableRequestInit }) => {
    try {
      const res = await fetch(args.url, args.init);
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* keep as text */
      }
      return { status: res.status, ok: res.ok, body };
    } catch (error) {
      return { status: 0, ok: false, body: (error as Error).message };
    }
  }, { url, init });
}

test.describe("applyBackendMocks", () => {
  test.beforeEach(async ({ page }) => {
    // Blank page so window.fetch is available. strict:true allow-list: about:blank triggers no
    // backend request, so strict won't fire here.
    await page.goto("about:blank");
  });

  test("override fulfills a matching internal API request", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      { url: "/api/services/taxonomy", method: "GET", body: { fixture: "taxonomy" } },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    // Need a real origin for fetch — navigate to baseURL so fetch can hit /api paths.
    await page.goto(baseURL ?? "/");
    const result = await inPageFetch(page, "/api/services/taxonomy");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ fixture: "taxonomy" });
  });

  test("override matches by regex and method", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      { url: /\/api\/services\/genome\/.*/, method: "POST", body: { matched: "post" } },
      { url: /\/api\/services\/genome\/.*/, method: "GET", body: { matched: "get" } },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");

    const post = await inPageFetch(page, "/api/services/genome/search", { method: "POST" });
    expect(post.body).toEqual({ matched: "post" });

    const get = await inPageFetch(page, "/api/services/genome/search", { method: "GET" });
    expect(get.body).toEqual({ matched: "get" });
  });

  test("strict mode aborts an unmocked backend request and records it", async ({ page, baseURL }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    await page.goto(baseURL ?? "/");
    const result = await inPageFetch(page, "/api/services/unmocked-endpoint");
    // Strict mode calls route.abort("failed") which surfaces as a fetch network error in the page.
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    // The guard also records the leak. We don't assert exact count because the app's hydration
    // may fire its own /api calls (e.g. /api/auth/get-session) that strict also records.
    const leaks = getUnmockedBackendRequests(page);
    expect(leaks.some((r) => r.includes("/api/services/unmocked-endpoint"))).toBe(true);
    expect(() => verifyNoUnmockedBackendRequests(page)).toThrow(/unmocked backend request/);
  });

  test("verifyNoUnmockedBackendRequests is a no-op when nothing leaked", async ({ page }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    // Stay on about:blank — no browser requests means nothing for strict to record.
    // This exercises the empty-leak path in isolation from any app hydration fetches.
    expect(getUnmockedBackendRequests(page)).toEqual([]);
    expect(() => verifyNoUnmockedBackendRequests(page)).not.toThrow();
  });

  test("strict mode lets non-backend navigation pass through", async ({ page, baseURL }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    const response = await page.goto(baseURL ?? "/");
    // The document response itself is served by Next, not a backend — goto must succeed even
    // though downstream /api calls from hydration get aborted by strict.
    expect(response?.ok()).toBe(true);
  });

  test("overrides win over strict mode", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      { url: "/api/auth/get-session", method: "GET", body: { user: null } },
    ];
    await applyBackendMocks(page, { overrides, strict: true });
    await page.goto(baseURL ?? "/");

    const result = await inPageFetch(page, "/api/auth/get-session");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ user: null });
    // Override handled /api/auth/get-session, so that specific URL was never recorded as a leak.
    // (Other app-internal /api calls may get recorded; we only assert about the override target.)
    expect(
      getUnmockedBackendRequests(page).filter((r) => r.includes("/api/auth/get-session")),
    ).toHaveLength(0);
  });

  test("first matching override wins when multiple apply", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      { url: /\/api\/workspace\//, body: { winner: "first" } },
      { url: /\/api\/workspace\/view/, body: { winner: "second" } },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");

    const result = await inPageFetch(page, "/api/workspace/view/something");
    expect(result.body).toEqual({ winner: "first" });
  });
});
