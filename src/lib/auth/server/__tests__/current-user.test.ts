import { delay, http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  setTestSession,
  testCookieStore,
} from "@/test-helpers/api-route-helpers";
import { getCurrentUser } from "../actions";
import { requireCurrentUserOrRedirect } from "../page-auth";

// The setup file mocks `next/headers` with cookies only; the redirect branch of
// `requireCurrentUserOrRedirect` also reads the proxy-forwarded request path.
vi.mock("next/headers", async () => {
  const helpers = await import("@/test-helpers/api-route-helpers");
  return {
    cookies: vi.fn(() => Promise.resolve(helpers.testCookieStore)),
    headers: vi.fn(() =>
      Promise.resolve(new Headers({ "x-dxkb-request-path": "/jobs?page=2" })),
    ),
  };
});

const userUrl = "http://mock-user-url";
const profileUrl = `${userUrl}/:userId`;

const validProfile = {
  id: "alice@patricbrc.org",
  l_id: "alice",
  email: "alice@example.com",
  email_verified: true,
  first_name: "Alice",
  last_name: "User",
  creation_date: "",
  last_login: "",
  organisms: "",
  reverification: false,
  source: "test",
  roles: ["admin"],
};

const maintenancePage =
  "<!DOCTYPE html><html><body><h1>Service Unavailable</h1>BV-BRC is undergoing maintenance.</body></html>";

beforeEach(() => {
  process.env.USER_URL = userUrl;
  setTestSession({
    token: "un=alice@patricbrc.org|sig",
    userId: "alice@patricbrc.org",
    realm: "patricbrc.org",
  });
});

afterEach(() => {
  delete process.env.USER_URL;
  vi.useRealTimers();
});

function expectSessionCookiesKept(): void {
  expect(testCookieStore.set).not.toHaveBeenCalled();
}

describe("getCurrentUser", () => {
  it("returns the verified profile user when the lookup succeeds", async () => {
    server.use(http.get(profileUrl, () => HttpResponse.json(validProfile)));

    const user = await getCurrentUser();

    expect(user).toMatchObject({
      id: "alice@patricbrc.org",
      username: "alice",
      email: "alice@example.com",
      realm: "patricbrc.org",
      roles: ["admin"],
    });
    expect(user).not.toHaveProperty("sessionUnverified");
  });

  it("returns null without a session", async () => {
    testCookieStore.set("bvbrc_token", "");
    testCookieStore.set("bvbrc_user_id", "");
    testCookieStore.set.mockClear();

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it.each([401, 403])(
    "treats a profile %i as signed out and keeps the cookies",
    async (status) => {
      server.use(
        http.get(profileUrl, () =>
          HttpResponse.json({ error: "Invalid token" }, { status }),
        ),
      );

      await expect(getCurrentUser()).resolves.toBeNull();
      expectSessionCookiesKept();
    },
  );

  it("treats a profile 404 for the session user as signed out", async () => {
    server.use(
      http.get(profileUrl, () =>
        HttpResponse.json({ error: "User not found" }, { status: 404 }),
      ),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it.each([500, 502, 503])(
    "keeps the session user signed in, unverified, on a profile %i",
    async (status) => {
      server.use(
        http.get(
          profileUrl,
          () =>
            new HttpResponse(maintenancePage, {
              status,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const user = await getCurrentUser();

      expect(user).toEqual({
        id: "alice@patricbrc.org",
        username: "alice@patricbrc.org",
        email: "",
        realm: "patricbrc.org",
        roles: [],
        sessionUnverified: true,
        sessionUnverifiedReason: `The account service is unavailable (HTTP ${String(status)}).`,
      });
      expect(user?.sessionUnverifiedReason).not.toMatch(/<|maintenance/i);
      expectSessionCookiesKept();
    },
  );

  it("keeps the session user signed in, unverified, on a 429", async () => {
    server.use(
      http.get(profileUrl, () => new HttpResponse(null, { status: 429 })),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
    });
  });

  it("keeps the session user signed in, unverified, on a 408", async () => {
    server.use(
      http.get(profileUrl, () => new HttpResponse(null, { status: 408 })),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
      sessionUnverifiedReason: "The account service did not respond in time.",
    });
    expectSessionCookiesKept();
  });

  it("keeps the session user signed in when the profile service is unreachable", async () => {
    server.use(http.get(profileUrl, () => HttpResponse.error()));

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
      sessionUnverifiedReason: "The account service could not be reached.",
    });
    expectSessionCookiesKept();
  });

  it("keeps the session user signed in when a 200 carries a maintenance page", async () => {
    server.use(
      http.get(
        profileUrl,
        () =>
          new HttpResponse(maintenancePage, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
    });
  });

  it("gives up on a hung profile lookup after 5 seconds and keeps the session", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.use(
      http.get(profileUrl, async () => {
        await delay("infinite");
        return HttpResponse.json(validProfile);
      }),
    );

    let settled = false;
    const pending = getCurrentUser().finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_900);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
      sessionUnverifiedReason: "The account service did not respond in time.",
    });
    expectSessionCookiesKept();
  });

  it("keeps the impersonation markers for an unverified SU session", async () => {
    testCookieStore.set("bvbrc_su_original_token", "un=admin@bvbrc|sig");
    testCookieStore.set("bvbrc_su_original_user_id", "admin@bvbrc");
    testCookieStore.set.mockClear();
    server.use(
      http.get(profileUrl, () => new HttpResponse(null, { status: 503 })),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "alice@patricbrc.org",
      sessionUnverified: true,
      isImpersonating: true,
      originalUsername: "admin@bvbrc",
    });
  });
});

describe("requireCurrentUserOrRedirect", () => {
  it("renders the protected page for an unverified session user", async () => {
    server.use(
      http.get(profileUrl, () => new HttpResponse(null, { status: 503 })),
    );

    await expect(requireCurrentUserOrRedirect("/jobs")).resolves.toMatchObject(
      { id: "alice@patricbrc.org", sessionUnverified: true },
    );
  });

  it("redirects to sign-in when the profile service rejects the token", async () => {
    server.use(
      http.get(profileUrl, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(requireCurrentUserOrRedirect("/jobs")).rejects.toThrow(
      `NEXT_REDIRECT: /sign-in?redirect=/jobs?page%3D2`,
    );
  });
});
