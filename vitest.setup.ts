import React from "react";
import "@testing-library/jest-dom/vitest";

// vitest's populateGlobal skips localStorage/sessionStorage because Node.js v25+
// already defines them (Web Storage is unflagged; without --localstorage-file the
// getter returns undefined). Explicitly re-bind to jsdom's working implementations
// via global.jsdom, which vitest always sets for the jsdom environment. Done in
// beforeEach, not beforeAll: a suite's `vi.unstubAllGlobals()` restores Node's
// undefined getter, and a once-per-file stub would leave every later test in that
// file without storage.
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

// `server-only` throws outside Next's bundler (it relies on the `react-server`
// export condition, which vitest does not set). The auth server modules, and so
// every route and page test that reaches them, import it through
// `profile-cache.ts`, as this file does to clear that cache between tests.
// This mock covers every test file, so a new test needs no
// `vi.mock("server-only", ...)` of its own; the per-file copies that predate it
// are redundant and harmless.
vi.mock("server-only", () => ({}));

// Mock next/navigation
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

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: Record<string, unknown>) =>
    React.createElement("img", { src, alt, ...rest }),
}));

// Suppress console.error noise in tests (auto-restored by restoreMocks)
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// MSW server lifecycle — strict mode rejects any unhandled fetch calls
import { server } from "@/test-helpers/msw-server";
// The signed-in profile cache outlives a request by design; no test may inherit
// another's cached profile.
import { clearProfileCache } from "@/lib/auth/server/profile-cache";
beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => {
  server.resetHandlers();
  clearTestCookies();
  clearProfileCache();
});
afterAll(() => { server.close(); });
