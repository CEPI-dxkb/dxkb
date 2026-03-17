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
  getBvbrcAuthToken,
  serverAuthenticatedFetch,
} from "../auth";

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

describe("getBvbrcAuthToken", () => {
  it("returns decoded token when cookie exists", async () => {
    mockCookieStore.get.mockReturnValue({
      value: "un%3Duser%40bvbrc.org%7Csig%3Dabc",
    });

    const token = await getBvbrcAuthToken();

    expect(mockCookieStore.get).toHaveBeenCalledWith("bvbrc_token");
    expect(token).toBe("un=user@bvbrc.org|sig=abc");
  });

  it("returns undefined when no cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const token = await getBvbrcAuthToken();

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
