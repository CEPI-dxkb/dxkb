import React from "react";
import "@testing-library/jest-dom/vitest";

// vitest skips localStorage/sessionStorage because Node 25+ defines them, so
// re-bind jsdom's in beforeEach (a suite's `vi.unstubAllGlobals()` restores
// Node's undefined getter).
beforeEach(() => {
  const dom = (global as unknown as { jsdom?: { window: Window & typeof globalThis } }).jsdom;
  if (dom) {
    vi.stubGlobal("localStorage", dom.window.localStorage);
    vi.stubGlobal("sessionStorage", dom.window.sessionStorage);
  }
});


const { clearTestCookies, testCookieStore } = await import(
  "@/test-helpers/api-route-helpers"
);

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(testCookieStore)),
}));

// `server-only` throws outside Next's bundler; this global mock covers every
// test file, so none needs its own.
vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: Record<string, unknown>) =>
    React.createElement("img", { src, alt, ...rest }),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

import { server } from "@/test-helpers/msw-server";
// The profile and shared upstream caches outlive a request by design, so clear
// them between tests.
import { clearProfileCache } from "@/lib/auth/server/profile-cache";
import { clearAllSharedCaches } from "@/lib/shared-cache";
beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => {
  server.resetHandlers();
  clearTestCookies();
  clearProfileCache();
  clearAllSharedCaches();
});
afterAll(() => { server.close(); });
