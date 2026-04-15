import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  getAuthToken,
  serverAuthenticatedFetch,
  extractRealmFromToken,
  createSession,
  deleteSession,
  getSession,
  requireAuth,
  requireAuthToken,
  createSuBackup,
  getSuBackup,
  deleteSuBackup,
  restoreSuBackup,
} from "../session";

describe("getAuthToken", () => {
  it("returns decoded token when cookie exists", async () => {
    mockCookieStore.get.mockReturnValue({
      value: "un%3Duser%40bvbrc.org%7Csig%3Dabc",
    });

    const token = await getAuthToken();

    expect(mockCookieStore.get).toHaveBeenCalledWith("bvbrc_token");
    expect(token).toBe("un=user@bvbrc.org|sig=abc");
  });

  it("returns undefined when no cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const token = await getAuthToken();

    expect(mockCookieStore.get).toHaveBeenCalledWith("bvbrc_token");
    expect(token).toBeUndefined();
  });
});

describe("serverAuthenticatedFetch", () => {
  it("adds Authorization header when authenticated", async () => {
    const testToken = "un=testuser@bvbrc.org|sig=abc123";
    mockCookieStore.get.mockReturnValue({ value: testToken });

    let capturedRequest: { url: string; headers: Headers } | null = null;
    server.use(
      http.get("https://api.example.com/data", async ({ request }) => {
        capturedRequest = {
          url: request.url,
          headers: request.headers,
        };
        return HttpResponse.json({ ok: true });
      }),
    );

    await serverAuthenticatedFetch("https://api.example.com/data");

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest?.headers.get("Authorization")).toBe(testToken);
    expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
  });

  it("throws when not authenticated", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await expect(
      serverAuthenticatedFetch("https://api.example.com/data"),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("extractRealmFromToken", () => {
  it("extracts realm from a token with un=user@realm", () => {
    const result = extractRealmFromToken(
      "un=user@patricbrc.org|tokenid=abc",
    );
    expect(result).toBe("patricbrc.org");
  });

  it("returns undefined when no @ in un value", () => {
    const result = extractRealmFromToken("un=user|tokenid=abc");
    expect(result).toBeUndefined();
  });

  it("returns undefined when no un= match", () => {
    const result = extractRealmFromToken("tokenid=abc|sig=xyz");
    expect(result).toBeUndefined();
  });

  it("handles realm with subdomain", () => {
    const result = extractRealmFromToken("un=admin@sub.example.com|sig=abc");
    expect(result).toBe("sub.example.com");
  });

  it("returns undefined for an empty string", () => {
    const result = extractRealmFromToken("");
    expect(result).toBeUndefined();
  });
});

describe("createSession", () => {
  it("sets bvbrc_token and bvbrc_user_id cookies", async () => {
    await createSession("mytoken", "testuser");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_token",
      "mytoken",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "testuser",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("optionally sets bvbrc_realm when provided", async () => {
    await createSession("mytoken", "testuser", "patricbrc.org");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "patricbrc.org",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("clears bvbrc_realm when not provided", async () => {
    await createSession("mytoken", "testuser");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it("extracts userId from profile when available", async () => {
    await createSession("mytoken", "user@realm.org", undefined, {
      id: "profileUserId",
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "profileUserId",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("extracts userId from username (local part) when no profile", async () => {
    await createSession("mytoken", "user@realm.org");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "user",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });
});

describe("deleteSession", () => {
  it("calls set with maxAge: 0 for all auth cookie names including SU backups", async () => {
    await deleteSession();

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

describe("getSession", () => {
  it("returns token, userId, and realm from cookies", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_token: "mytoken",
        bvbrc_user_id: "testuser",
        bvbrc_realm: "patricbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const result = await getSession();

    expect(result).toEqual({
      token: "mytoken",
      userId: "testuser",
      realm: "patricbrc.org",
    });
  });

  it("returns undefined values when cookies are missing", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await getSession();

    expect(result).toEqual({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
  });

  it("returns credentials when session is valid", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_token: "tok",
        bvbrc_user_id: "user1",
        bvbrc_realm: "bvbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const result = await requireAuth();

    expect(result).toEqual({ token: "tok", userId: "user1", realm: "bvbrc.org" });
  });

  it("returns 401 NextResponse when token is missing", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_user_id") return { value: "user1" };
      return undefined;
    });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Authentication required" });
  });

  it("returns 401 NextResponse when userId is missing", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_token") return { value: "tok" };
      return undefined;
    });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("requireAuthToken", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
  });

  it("returns the token string when cookie exists", async () => {
    mockCookieStore.get.mockReturnValue({ value: "my-token" });

    const result = await requireAuthToken();

    expect(result).toBe("my-token");
  });

  it("returns 401 NextResponse with error key when cookie is missing", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await requireAuthToken();

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Authentication required" });
  });
});

describe("createSuBackup", () => {
  beforeEach(() => {
    mockCookieStore.set.mockReset();
  });

  it("sets bvbrc_su_original_token, _user_id, and _realm cookies", async () => {
    await createSuBackup("admin-token", "admin", "bvbrc.org");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_token",
      "admin-token",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_user_id",
      "admin",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_realm",
      "bvbrc.org",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("clears realm cookie when realm is not provided", async () => {
    await createSuBackup("admin-token", "admin");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_realm",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});

describe("getSuBackup", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
  });

  it("returns token, userId, realm from SU backup cookies", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_su_original_token: "admin-token",
        bvbrc_su_original_user_id: "admin",
        bvbrc_su_original_realm: "bvbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const result = await getSuBackup();

    expect(result).toEqual({
      token: "admin-token",
      userId: "admin",
      realm: "bvbrc.org",
    });
  });

  it("returns undefined values when no SU backup cookies exist", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await getSuBackup();

    expect(result).toEqual({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });
  });
});

describe("deleteSuBackup", () => {
  beforeEach(() => {
    mockCookieStore.set.mockReset();
  });

  it("clears all SU backup cookies", async () => {
    await deleteSuBackup();

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
  });
});

describe("restoreSuBackup", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
    mockCookieStore.set.mockReset();
  });

  it("copies backup cookies to primary and clears backups", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_su_original_token: "admin-token",
        bvbrc_su_original_user_id: "admin",
        bvbrc_su_original_realm: "bvbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const result = await restoreSuBackup();

    expect(result).toEqual({
      token: "admin-token",
      userId: "admin",
      realm: "bvbrc.org",
    });

    // Verify primary cookies were set
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_token",
      "admin-token",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "admin",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "bvbrc.org",
      expect.objectContaining({ httpOnly: true }),
    );

    // Verify backups were cleared
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_su_original_token",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it("returns undefined values when no backup exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await restoreSuBackup();

    expect(result).toEqual({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });
  });
});
