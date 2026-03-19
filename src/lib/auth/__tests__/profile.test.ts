vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { getProfileMetadata, getUserEmailByUsername } from "../profile";

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
