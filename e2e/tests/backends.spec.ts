import { test, expect } from "@playwright/test";
import { applyBackendMocks, type JsonOverride } from "../mocks/backends";

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

async function inPageFetch(page: import("@playwright/test").Page, url: string, init?: RequestInit): Promise<FetchResult> {
  return page.evaluate(
    async ([u, i]: [string, RequestInit | undefined]) => {
      try {
        const res = await fetch(u, i);
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
    },
    [url, init],
  );
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

  test("strict mode aborts an unmocked backend request", async ({ page, baseURL }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    await page.goto(baseURL ?? "/");
    const result = await inPageFetch(page, "/api/services/unmocked-endpoint");
    // Strict mode calls route.abort("failed") which surfaces as a fetch network error in the page.
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
  });

  test("strict mode lets non-backend navigation pass through", async ({ page, baseURL }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    const response = await page.goto(baseURL ?? "/");
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
