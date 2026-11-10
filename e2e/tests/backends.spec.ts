import { test, expect } from "@playwright/test";
import {
  applyBackendMocks,
  getUnmockedBackendRequests,
  verifyNoUnmockedBackendRequests,
  type JsonOverride,
} from "../mocks/backends";

/**
 * Self-tests for applyBackendMocks: override/HAR/strict precedence and non-backend
 * fallthrough. Uses in-page fetch so requests flow through page.route().
 */

interface FetchResult {
  status: number;
  ok: boolean;
  body: unknown;
}

// Playwright's page.evaluate needs JSON-safe args, which the full RequestInit is not.
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
  return page.evaluate(
    async (args: { url: string; init?: SerializableRequestInit }) => {
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
    },
    { url, init },
  );
}

test.describe("applyBackendMocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("about:blank");
  });

  test("override fulfills a matching internal API request", async ({
    page,
    baseURL,
  }) => {
    const overrides: JsonOverride[] = [
      {
        url: "/api/services/taxonomy",
        method: "GET",
        body: { fixture: "taxonomy" },
      },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");
    const result = await inPageFetch(page, "/api/services/taxonomy");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ fixture: "taxonomy" });
  });

  test("override matches by regex and method", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      {
        url: /\/api\/services\/genome\/.*/,
        method: "POST",
        body: { matched: "post" },
      },
      {
        url: /\/api\/services\/genome\/.*/,
        method: "GET",
        body: { matched: "get" },
      },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");

    const post = await inPageFetch(page, "/api/services/genome/search", {
      method: "POST",
    });
    expect(post.body).toEqual({ matched: "post" });

    const get = await inPageFetch(page, "/api/services/genome/search", {
      method: "GET",
    });
    expect(get.body).toEqual({ matched: "get" });
  });

  test("strict mode aborts an unmocked backend request and records it", async ({
    page,
    baseURL,
  }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    await page.goto(baseURL ?? "/");
    const result = await inPageFetch(page, "/api/services/unmocked-endpoint");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    const leaks = getUnmockedBackendRequests(page);
    expect(
      leaks.some((r) => r.includes("/api/services/unmocked-endpoint")),
    ).toBe(true);
    expect(() => {
      verifyNoUnmockedBackendRequests(page);
    }).toThrow(/unmocked backend request/);
  });

  test("verifyNoUnmockedBackendRequests is a no-op when nothing leaked", async ({
    page,
  }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    expect(getUnmockedBackendRequests(page)).toEqual([]);
    expect(() => {
      verifyNoUnmockedBackendRequests(page);
    }).not.toThrow();
  });

  test("strict mode lets non-backend navigation pass through", async ({
    page,
    baseURL,
  }) => {
    await applyBackendMocks(page, { overrides: [], strict: true });
    const response = await page.goto(baseURL ?? "/");
    expect(response?.ok()).toBe(true);
  });

  test("overrides win over strict mode", async ({ page, baseURL }) => {
    const overrides: JsonOverride[] = [
      {
        url: "/api/services/genome/search",
        method: "GET",
        body: { genomes: [] },
      },
    ];
    await applyBackendMocks(page, { overrides, strict: true });
    await page.goto(baseURL ?? "/");

    const result = await inPageFetch(page, "/api/services/genome/search");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ genomes: [] });
    expect(
      getUnmockedBackendRequests(page).filter((r) =>
        r.includes("/api/services/genome/search"),
      ),
    ).toHaveLength(0);
  });

  test("first matching override wins when multiple apply", async ({
    page,
    baseURL,
  }) => {
    const overrides: JsonOverride[] = [
      { url: /\/api\/workspace\//, body: { winner: "first" } },
      { url: /\/api\/workspace\/view/, body: { winner: "second" } },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");

    const result = await inPageFetch(page, "/api/workspace/view/something");
    expect(result.body).toEqual({ winner: "first" });
  });

  test("matchBody routes same URL to different responses by request body", async ({
    page,
    baseURL,
  }) => {
    const overrides: JsonOverride[] = [
      {
        url: "/api/services/workspace",
        method: "POST",
        matchBody: (body) =>
          (body as { method?: string } | null)?.method === "Workspace.ls",
        body: { result: "ls-result" },
      },
      {
        url: "/api/services/workspace",
        method: "POST",
        matchBody: (body) =>
          (body as { method?: string } | null)?.method === "Workspace.get",
        body: { result: "get-result" },
      },
    ];
    await applyBackendMocks(page, { overrides, strict: false });
    await page.goto(baseURL ?? "/");

    const ls = await inPageFetch(page, "/api/services/workspace", {
      method: "POST",
      body: JSON.stringify({
        method: "Workspace.ls",
        params: [],
        id: 1,
        jsonrpc: "2.0",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(ls.body).toEqual({ result: "ls-result" });

    const get = await inPageFetch(page, "/api/services/workspace", {
      method: "POST",
      body: JSON.stringify({
        method: "Workspace.get",
        params: [],
        id: 2,
        jsonrpc: "2.0",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(get.body).toEqual({ result: "get-result" });
  });
});
