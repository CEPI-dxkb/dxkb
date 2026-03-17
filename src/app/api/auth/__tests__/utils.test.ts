const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/lib/auth", () => ({
  safeDecodeURIComponent: vi.fn((v: string) => v),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  extractRealmFromToken,
  getProfileMetadata,
  getUserEmailByUsername,
  setBvbrcAuthCookies,
  clearBvbrcAuthCookies,
  getBvbrcAuthData,
} from "../utils";

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

describe("getProfileMetadata", () => {
  it("returns profile on success", async () => {
    const profile = { id: "testuser", email: "test@example.com" };
    let capturedHeaders: Headers | null = null;

    server.use(
      http.get("http://mock-url/testuser", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json(profile);
      }),
    );

    const result = await getProfileMetadata("token123", "testuser");

    expect(result).toEqual(profile);
    expect(capturedHeaders?.get("Authorization")).toBe("token123");
  });

  it("returns null on HTTP error", async () => {
    server.use(
      http.get("http://mock-url/nouser", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    const result = await getProfileMetadata("token123", "nouser");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    server.use(
      http.get("http://mock-url/testuser", () => {
        return HttpResponse.error();
      }),
    );

    const result = await getProfileMetadata("token123", "testuser");

    expect(result).toBeNull();
  });
});

describe("getUserEmailByUsername", () => {
  it("returns email on success", async () => {
    let capturedHeaders: Headers | null = null;

    server.use(
      http.get("http://mock-url/testuser", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ email: "user@example.com" });
      }),
    );

    const result = await getUserEmailByUsername("testuser");

    expect(result).toBe("user@example.com");
    expect(capturedHeaders?.get("Accept")).toBe("application/json");
  });

  it("returns null when no email in response", async () => {
    server.use(
      http.get("http://mock-url/testuser", () => {
        return HttpResponse.json({ id: "testuser" });
      }),
    );

    const result = await getUserEmailByUsername("testuser");

    expect(result).toBeNull();
  });

  it("returns null on error", async () => {
    server.use(
      http.get("http://mock-url/testuser", () => {
        return HttpResponse.error();
      }),
    );

    const result = await getUserEmailByUsername("testuser");

    expect(result).toBeNull();
  });
});

describe("setBvbrcAuthCookies", () => {
  it("sets bvbrc_token and bvbrc_user_id cookies", async () => {
    await setBvbrcAuthCookies("mytoken", "testuser");

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
    await setBvbrcAuthCookies("mytoken", "testuser", "patricbrc.org");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_realm",
      "patricbrc.org",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("does not set bvbrc_realm when not provided", async () => {
    await setBvbrcAuthCookies("mytoken", "testuser");

    const realmCalls = mockCookieStore.set.mock.calls.filter(
      (call: unknown[]) => call[0] === "bvbrc_realm",
    );
    expect(realmCalls).toHaveLength(0);
  });

  it("extracts userId from profile when available", async () => {
    await setBvbrcAuthCookies("mytoken", "user@realm.org", undefined, {
      id: "profileUserId",
    });

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "profileUserId",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });

  it("extracts userId from username (local part) when no profile", async () => {
    await setBvbrcAuthCookies("mytoken", "user@realm.org");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "bvbrc_user_id",
      "user",
      expect.objectContaining({ maxAge: 3600 * 4 }),
    );
  });
});

describe("clearBvbrcAuthCookies", () => {
  it("calls set with maxAge: 0 for all cookie names", async () => {
    await clearBvbrcAuthCookies();

    const expectedCookies = [
      "bvbrc_token",
      "bvbrc_realm",
      "bvbrc_user_profile",
      "bvbrc_user_id",
      "token",
      "auth",
      "refresh_token",
      "user_id",
      "realm",
      "user_profile",
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

describe("getBvbrcAuthData", () => {
  it("returns token, userId, and realm from cookies", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        bvbrc_token: "mytoken",
        bvbrc_user_id: "testuser",
        bvbrc_realm: "patricbrc.org",
      };
      return values[name] ? { value: values[name] } : undefined;
    });

    const result = await getBvbrcAuthData();

    expect(result).toEqual({
      token: "mytoken",
      userId: "testuser",
      realm: "patricbrc.org",
    });
  });

  it("returns undefined values when cookies are missing", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await getBvbrcAuthData();

    expect(result).toEqual({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });
  });
});
