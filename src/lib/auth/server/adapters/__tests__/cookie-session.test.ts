const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  cookieSession,
  sessionCookieNames,
  suBackupCookieNames,
} from "../cookie-session";

beforeEach(() => {
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

describe("cookieSession().read", () => {
  it("returns the decoded session when all cookies are present", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_token: "un%3Duser%40bvbrc.org%7Csig%3Dabc",
        bvbrc_user_id: "testuser",
        bvbrc_realm: "patricbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const identity = await cookieSession().read();

    expect(identity).toEqual(
      expect.objectContaining({
        token: "un=user@bvbrc.org|sig=abc",
        userId: "testuser",
        realm: "patricbrc.org",
      }),
    );
    expect(typeof identity?.expiresAt).toBe("number");
  });

  it("returns null when token cookie is missing", async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === "bvbrc_user_id" ? { value: "u1" } : undefined,
    );

    expect(await cookieSession().read()).toBeNull();
  });

  it("returns null when userId cookie is missing", async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === "bvbrc_token" ? { value: "tok" } : undefined,
    );

    expect(await cookieSession().read()).toBeNull();
  });

  it("omits realm when cookie is empty string", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_token: "tok",
        bvbrc_user_id: "u1",
        bvbrc_realm: "",
      };
      return { value: values[name] ?? "" };
    });

    const identity = await cookieSession().read();

    expect(identity?.realm).toBeUndefined();
  });
});

describe("cookieSession().write", () => {
  it("sets token, userId, and realm cookies with the expected options", async () => {
    await cookieSession().write({
      token: "my-token",
      userId: "me",
      realm: "bvbrc.org",
      expiresAt: Date.now() + 1000,
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_token",
      "my-token",
      expect.objectContaining({ httpOnly: true, path: "/", maxAge: 3600 * 4 }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "me",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "bvbrc.org",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("clears the realm cookie when no realm is provided", async () => {
    await cookieSession().write({
      token: "t",
      userId: "u",
      expiresAt: Date.now(),
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});

describe("cookieSession().clear", () => {
  it("clears all 7 auth cookies (matching the legacy deleteSession list)", async () => {
    await cookieSession().clear();

    const expectedCookies = [
      "bvbrc_token",
      "bvbrc_realm",
      "bvbrc_user_profile",
      "bvbrc_user_id",
      "bvbrc_su_original_token",
      "bvbrc_su_original_user_id",
      "bvbrc_su_original_realm",
    ];

    for (const name of expectedCookies) {
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        name,
        "",
        expect.objectContaining({ maxAge: 0 }),
      );
    }
    expect(mockCookieStore.set).toHaveBeenCalledTimes(expectedCookies.length);
  });
});

describe("cookieSession() SU backup helpers", () => {
  it("writeBackup sets all three backup cookies", async () => {
    await cookieSession().writeBackup({
      token: "admin-token",
      userId: "admin",
      realm: "bvbrc.org",
      expiresAt: Date.now() + 1000,
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_token",
      "admin-token",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_user_id",
      "admin",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_realm",
      "bvbrc.org",
      expect.anything(),
    );
  });

  it("writeBackup clears realm when not provided", async () => {
    await cookieSession().writeBackup({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now() + 1000,
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_realm",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it("readBackup returns the backup identity when cookies are present", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_su_original_token: "admin-token",
        bvbrc_su_original_user_id: "admin",
        bvbrc_su_original_realm: "bvbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const backup = await cookieSession().readBackup();

    expect(backup).toEqual(
      expect.objectContaining({
        token: "admin-token",
        userId: "admin",
        realm: "bvbrc.org",
      }),
    );
  });

  it("readBackup returns null when the backup cookies are missing", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    expect(await cookieSession().readBackup()).toBeNull();
  });

  it("clearBackup clears only the three backup cookies", async () => {
    await cookieSession().clearBackup();

    for (const name of [
      "bvbrc_su_original_token",
      "bvbrc_su_original_user_id",
      "bvbrc_su_original_realm",
    ]) {
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        name,
        "",
        expect.objectContaining({ maxAge: 0 }),
      );
    }
    expect(mockCookieStore.set).toHaveBeenCalledTimes(3);
  });
});

describe("cookie name constants", () => {
  it("exports the main session cookie names", () => {
    expect(sessionCookieNames).toEqual({
      token: "bvbrc_token",
      userId: "bvbrc_user_id",
      realm: "bvbrc_realm",
    });
  });

  it("exports the SU backup cookie names", () => {
    expect(suBackupCookieNames).toEqual({
      token: "bvbrc_su_original_token",
      userId: "bvbrc_su_original_user_id",
      realm: "bvbrc_su_original_realm",
    });
  });
});
