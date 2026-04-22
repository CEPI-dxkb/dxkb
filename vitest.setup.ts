import React from "react";
import "@testing-library/jest-dom/vitest";

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

// During the auth-authority migration, existing service route tests mock
// `@/lib/auth/session.getAuthToken` to stub authentication. `auth.route` no
// longer reads that helper, so we override the default exported `auth.route`
// / `withAuth` to bridge through the session mock — preserving test intent
// without rewriting every call site. Tests that exercise the real auth.route
// logic use `createAuth()` directly and are unaffected.
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>();

  type RouteHandler = (req: unknown, ctx: unknown) => Promise<Response>;

  const route = <H extends RouteHandler>(handler: H) =>
    (async (req: unknown, ctx: unknown): Promise<Response> => {
      const sessionModule = await import("@/lib/auth/session");
      const token = await sessionModule.getAuthToken();
      if (!token) {
        return new Response(
          JSON.stringify({
            error: "Authentication required",
            code: "unauthenticated",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let userId = "testuser";
      let realm: string | undefined;
      try {
        const session = await sessionModule.getSession();
        if (session.userId) userId = session.userId;
        realm = session.realm;
      } catch {
        // Tests that don't mock cookies fall back to default userId.
      }
      const contextRecord =
        typeof ctx === "object" && ctx !== null
          ? (ctx as Record<string, unknown>)
          : {};
      try {
        return await handler(req, {
          ...contextRecord,
          token,
          userId,
          realm,
        });
      } catch (error) {
        return actual.errorResponse(error);
      }
    }) as unknown as H;

  return {
    ...actual,
    auth: { ...actual.auth, route },
    withAuth: route,
  };
});

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
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
