const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`);
    throw error;
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import { NextRequest, NextResponse } from "next/server";
import { createAuth } from "../create";
import {
  inMemoryIdentity,
  inMemorySession,
  type InMemoryAccount,
} from "../adapters/memory";
import type { UserProfile } from "@/lib/auth/types";

function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "alice",
    email: "alice@example.com",
    email_verified: true,
    first_name: "Alice",
    last_name: "Wonder",
    creation_date: "2024-01-01",
    last_login: "2024-01-01",
    organisms: "",
    reverification: false,
    source: "memory",
    l_id: "alice",
    ...partial,
  };
}

function makeAccount(username: string): InMemoryAccount {
  return {
    username,
    password: "pw",
    token: `${username}-token`,
    profile: makeProfile({ id: username, l_id: username }),
  };
}

function buildAuthority(accounts: InMemoryAccount[] = []) {
  const identity = inMemoryIdentity({ accounts, suPassword: "su-pw" });
  const session = inMemorySession();
  const { auth, authAdmin } = createAuth({ identity, session });
  return { auth, authAdmin, identity, session };
}

describe("auth.hasSession", () => {
  it("returns true when both cookies are present", () => {
    const { auth } = buildAuthority();
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "bvbrc_token=t; bvbrc_user_id=u" },
    });
    expect(auth.hasSession(req)).toBe(true);
  });

  it("returns false when token is missing", () => {
    const { auth } = buildAuthority();
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "bvbrc_user_id=u" },
    });
    expect(auth.hasSession(req)).toBe(false);
  });

  it("returns false when userId is missing", () => {
    const { auth } = buildAuthority();
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "bvbrc_token=t" },
    });
    expect(auth.hasSession(req)).toBe(false);
  });
});

describe("auth.route", () => {
  it("returns 401 when no session exists", async () => {
    const { auth } = buildAuthority();
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = auth.route(handler);

    const req = new NextRequest("http://localhost/api/x");
    const response = await wrapped(req, {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("injects token/userId/realm into the handler context when authenticated", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      realm: "bvbrc.org",
      expiresAt: Date.now(),
    });

    const handler = vi.fn(async (_req, ctx) => NextResponse.json(ctx));
    const wrapped = auth.route(handler);

    const req = new NextRequest("http://localhost/api/x");
    const response = await wrapped(req, {});

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        token: "alice-token",
        userId: "alice",
        realm: "bvbrc.org",
      }),
    );
  });

  it("memoizes session.read and identity.validateToken across the request", async () => {
    const { auth, session, identity } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const readSpy = vi.spyOn(session, "read");
    const validateSpy = vi.spyOn(identity, "validateToken");

    const wrapped = auth.route(async (_req, ctx) => {
      expect(ctx.token).toBe("alice-token");
      const user1 = await auth.currentUser();
      const user2 = await auth.currentUser();
      expect(user1?.username).toBe("alice");
      expect(user2?.username).toBe("alice");
      return NextResponse.json({ ok: true });
    });

    await wrapped(new NextRequest("http://localhost/"), {});

    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it("returns a Response thrown by the handler unchanged", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const wrapped = auth.route(async () => {
      throw NextResponse.json({ error: "forced" }, { status: 418 });
    });

    const response = await wrapped(new NextRequest("http://localhost/"), {});

    expect(response.status).toBe(418);
    const body = await response.json();
    expect(body).toEqual({ error: "forced" });
  });

  it("maps thrown Error via errorResponse", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const wrapped = auth.route(async () => {
      throw new Error("boom");
    });

    const response = await wrapped(new NextRequest("http://localhost/"), {});

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("boom");
  });
});

describe("auth.fetch", () => {
  const fetchSpy = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy.mockReset();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("attaches Authorization from the current session", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    await auth.fetch("https://backend/foo");

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(callInit.headers);
    expect(headers.get("Authorization")).toBe("alice-token");
  });

  it("clears session cookies when upstream returns 401", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));

    await auth.fetch("https://backend/foo");

    expect(session.inspect().current).toBeNull();
  });

  it("does not clear session for non-401 responses", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

    await auth.fetch("https://backend/foo");

    expect(session.inspect().current?.token).toBe("alice-token");
  });

  it("throws a 401 NextResponse when called without a session", async () => {
    const { auth } = buildAuthority();
    await expect(auth.fetch("https://backend/foo")).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("auth.requireSession", () => {
  it("returns the session when present", async () => {
    const { auth, session } = buildAuthority();
    await session.write({
      token: "t",
      userId: "u",
      realm: "r",
      expiresAt: Date.now(),
    });
    expect(await auth.requireSession()).toEqual(
      expect.objectContaining({ token: "t", userId: "u", realm: "r" }),
    );
  });

  it("throws a 401 NextResponse when absent", async () => {
    const { auth } = buildAuthority();
    await expect(auth.requireSession()).rejects.toMatchObject({ status: 401 });
  });
});

describe("auth.currentUser", () => {
  it("returns null when no session is present", async () => {
    const { auth } = buildAuthority();
    expect(await auth.currentUser()).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "stale",
      userId: "alice",
      expiresAt: Date.now(),
    });
    expect(await auth.currentUser()).toBeNull();
  });

  it("returns a hydrated user when session is valid", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    const user = await auth.currentUser();
    expect(user?.username).toBe("alice");
    expect(user?.isImpersonating).toBeUndefined();
  });

  it("flags isImpersonating when a backup session is stored", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    await session.writeBackup({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });
    const user = await auth.currentUser();
    expect(user?.isImpersonating).toBe(true);
    expect(user?.originalUsername).toBe("admin");
  });
});

describe("auth.requireUser", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT: ${url}`);
    });
  });

  it("returns the user when authenticated", async () => {
    const { auth, session } = buildAuthority([makeAccount("alice")]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    const user = await auth.requireUser();
    expect(user.username).toBe("alice");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to /sign-in by default when no session", async () => {
    const { auth } = buildAuthority();
    await expect(auth.requireUser()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to the supplied path when provided", async () => {
    const { auth } = buildAuthority();
    await expect(auth.requireUser("/login")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
