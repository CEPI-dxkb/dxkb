import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  safeDecodeURIComponent,
  getAuthToken,
  serverAuthenticatedFetch,
  extractRealmFromToken,
  createSession,
  deleteSession,
  getSession,
} from "../session";

describe("safeDecodeURIComponent", () => {
  it("decodes a valid percent-encoded string", () => {
    expect(safeDecodeURIComponent("%20")).toBe(" ");
  });

  it("decodes a complex encoded string", () => {
    expect(safeDecodeURIComponent("hello%20world%21")).toBe("hello world!");
  });

  it("returns original string on malformed input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const malformed = "%E0%A4%A";
    expect(safeDecodeURIComponent(malformed)).toBe(malformed);
  });

  it("handles already-decoded strings", () => {
    expect(safeDecodeURIComponent("hello")).toBe("hello");
  });
});

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

  it("does not set bvbrc_realm when not provided", async () => {
    await createSession("mytoken", "testuser");

    const realmCalls = mockCookieStore.set.mock.calls.filter(
      (call: unknown[]) => call[0] === "bvbrc_realm",
    );
    expect(realmCalls).toHaveLength(0);
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
  it("calls set with maxAge: 0 for all auth cookie names", async () => {
    await deleteSession();

    const expectedCookies = [
      "bvbrc_token",
      "bvbrc_realm",
      "bvbrc_user_profile",
      "bvbrc_user_id",
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
