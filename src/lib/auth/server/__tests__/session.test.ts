interface CookieValue {
  value: string;
}

type CookieSetCall = [name: string, value: string, options?: unknown];

const { store } = vi.hoisted(() => ({
  store: {
    get: vi.fn<(name: string) => CookieValue | undefined>(),
    set: vi.fn<(...args: CookieSetCall) => void>(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(store)),
}));

import {
  clearCurrentSession,
  clearImpersonationBackup,
  clearSession,
  readImpersonationBackup,
  readSession,
  restoreImpersonationBackup,
  writeImpersonationBackup,
  writeSession,
} from "../session";
import { sessionMaxAgeMs } from "../cookies";
import { readCachedProfile, rememberProfile } from "../profile-cache";
import type { UserProfile } from "@/lib/auth/types";

beforeEach(() => {
  store.get.mockReset();
  store.set.mockReset();
  vi.useRealTimers();
});

function cookies(values: Record<string, string>) {
  store.get.mockImplementation((name: string) => {
    const value = values[name];
    return value ? { value } : undefined;
  });
}

describe("session cookies", () => {
  it("uses a 24-hour lifetime", () => {
    expect(sessionMaxAgeMs).toBe(24 * 60 * 60 * 1000);
  });

  it("reads a complete identity without synthesizing expiry", async () => {
    cookies({
      bvbrc_token: "token",
      bvbrc_user_id: "canonical",
      bvbrc_realm: "r",
    });
    expect(await readSession()).toEqual({
      token: "token",
      userId: "canonical",
      realm: "r",
    });
  });

  it("preserves malformed encoded tokens without throwing", async () => {
    cookies({ bvbrc_token: "%E0%A4%A", bvbrc_user_id: "canonical" });
    expect(await readSession()).toMatchObject({ token: "%E0%A4%A" });
  });

  it.each<Record<string, string>>([
    { bvbrc_token: "token" },
    { bvbrc_user_id: "canonical" },
  ])("rejects incomplete current identities", async (values) => {
    cookies(values);
    expect(await readSession()).toBeNull();
  });

  it("rejects incomplete impersonation backups", async () => {
    cookies({ bvbrc_su_original_token: "admin-token" });
    expect(await readImpersonationBackup()).toBeNull();
    expect(await restoreImpersonationBackup()).toBeNull();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("returns the exact expiry used by every written cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
    const expiresAt = await writeSession({
      token: "t",
      userId: "u",
      realm: "r",
    });
    expect(expiresAt).toBe(Date.now() + sessionMaxAgeMs);
    for (const call of store.set.mock.calls) {
      expect(call[2]).toMatchObject({
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: sessionMaxAgeMs / 1000,
        expires: new Date(expiresAt),
      });
    }
  });

  it("clears a stale realm when writing an identity without one", async () => {
    await writeSession({ token: "t", userId: "u" });
    expect(store.set).toHaveBeenLastCalledWith(
      "bvbrc_realm",
      "",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      }),
    );
  });

  it("writes and clears a complete impersonation backup", async () => {
    const expiresAt = await writeImpersonationBackup({
      token: "admin-token",
      userId: "admin-id",
      realm: "r",
    });
    expect(expiresAt).toEqual(expect.any(Number));
    expect(store.set.mock.calls.slice(0, 3).map((call) => call[0])).toEqual([
      "bvbrc_su_original_token",
      "bvbrc_su_original_user_id",
      "bvbrc_su_original_realm",
    ]);

    store.set.mockClear();
    await clearImpersonationBackup();
    expect(store.set.mock.calls.map((call) => call[0])).toEqual([
      "bvbrc_su_original_token",
      "bvbrc_su_original_user_id",
      "bvbrc_su_original_realm",
    ]);
    for (const call of store.set.mock.calls) {
      expect(call[2]).toMatchObject({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }
  });

  it("clears only current identity and migration state", async () => {
    await clearCurrentSession();
    const names = store.set.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      "bvbrc_token",
      "bvbrc_user_id",
      "bvbrc_realm",
      "bvbrc_user_profile",
    ]);
    expect(names).not.toContain("bvbrc_su_original_token");
    for (const call of store.set.mock.calls) {
      expect(call[2]).toMatchObject({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }
  });

  it("full clear includes the impersonation backup", async () => {
    await clearSession();
    expect(store.set.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        "bvbrc_token",
        "bvbrc_su_original_token",
        "bvbrc_su_original_user_id",
        "bvbrc_su_original_realm",
        "bvbrc_user_profile",
      ]),
    );
  });

  it("restores backup before clearing it", async () => {
    cookies({
      bvbrc_su_original_token: "admin-token",
      bvbrc_su_original_user_id: "admin-id",
      bvbrc_su_original_realm: "r",
    });
    expect(await restoreImpersonationBackup()).toEqual(expect.any(Number));
    expect(store.set.mock.calls.slice(0, 3).map((call) => call[0])).toEqual([
      "bvbrc_token",
      "bvbrc_user_id",
      "bvbrc_realm",
    ]);
    expect(store.set.mock.calls[3][0]).toBe("bvbrc_su_original_token");
  });
});

describe("cached profile eviction", () => {
  const profile = (id: string): UserProfile => ({
    id,
    l_id: id,
    email: `${id}@example.com`,
    email_verified: true,
    first_name: "First",
    last_name: "Last",
    creation_date: "",
    last_login: "",
    organisms: "",
    reverification: false,
    source: "test",
  });

  beforeEach(() => {
    cookies({
      bvbrc_token: "user-token",
      bvbrc_user_id: "user",
      bvbrc_su_original_token: "admin-token",
      bvbrc_su_original_user_id: "admin",
    });
    rememberProfile("user", "user-token", profile("user"));
    rememberProfile("admin", "admin-token", profile("admin"));
  });

  it("forgets the current token's profile when the current session is cleared", async () => {
    await clearCurrentSession();

    expect(readCachedProfile("user", "user-token")).toBeUndefined();
    // The SU backup cookies are kept, and so is their profile.
    expect(readCachedProfile("admin", "admin-token")).toEqual(profile("admin"));
  });

  it("forgets the current and SU backup tokens' profiles on a full clear", async () => {
    await clearSession();

    expect(readCachedProfile("user", "user-token")).toBeUndefined();
    expect(readCachedProfile("admin", "admin-token")).toBeUndefined();
  });
});
