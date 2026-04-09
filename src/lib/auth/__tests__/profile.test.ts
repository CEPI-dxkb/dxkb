vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { fetchUserProfile } from "../profile";

describe("fetchUserProfile", () => {
  it("returns profile on success", async () => {
    const profile = { id: "testuser", email: "test@example.com" };

    server.use(
      http.get("http://mock-url/testuser", () => HttpResponse.json(profile)),
    );

    const result = await fetchUserProfile("testuser");

    expect(result).toEqual(profile);
  });

  it("sends Authorization header when token is provided", async () => {
    let capturedAuthorization: string | null = null;

    server.use(
      http.get("http://mock-url/testuser", ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ id: "testuser" });
      }),
    );

    await fetchUserProfile("testuser", "my-token");

    expect(capturedAuthorization).toBe("my-token");
  });

  it("does not send Authorization header when token is omitted", async () => {
    let capturedAuthorization: string | null = null;

    server.use(
      http.get("http://mock-url/testuser", ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ id: "testuser" });
      }),
    );

    await fetchUserProfile("testuser");

    expect(capturedAuthorization).toBeNull();
  });

  it("encodes username in URL", async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get("http://mock-url/:userId", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({});
      }),
    );

    await fetchUserProfile("user@realm.org");

    expect(capturedUrl).toBe("http://mock-url/user%40realm.org");
  });

  it("returns null on HTTP error", async () => {
    server.use(
      http.get("http://mock-url/nouser", () =>
        new HttpResponse(null, { status: 404 }),
      ),
    );

    const result = await fetchUserProfile("nouser");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    server.use(
      http.get("http://mock-url/testuser", () => HttpResponse.error()),
    );

    const result = await fetchUserProfile("testuser");

    expect(result).toBeNull();
  });
});
