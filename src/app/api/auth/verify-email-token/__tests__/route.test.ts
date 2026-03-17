vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-verification-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "../route";

describe("GET /api/auth/verify-email-token", () => {
  it("returns 400 when token is missing", async () => {
    const request = mockNextRequest({
      searchParams: { username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toBe(
      "Verification token and username are required",
    );
  });

  it("returns 400 when username is missing", async () => {
    const request = mockNextRequest({
      searchParams: { token: "verify-token" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toBe(
      "Verification token and username are required",
    );
  });

  it("returns success with data on successful verification", async () => {
    const resultPayload = { verified: true, userId: "user123" };
    let capturedBody: unknown;
    server.use(
      http.post("http://mock-verification-url", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(resultPayload);
      }),
    );

    const request = mockNextRequest({
      searchParams: { token: "verify-token", username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Email verified successfully");
    expect(data.data).toEqual(resultPayload);
    expect(capturedBody).toEqual({
      token: "verify-token",
      username: "testuser",
    });
  });

  it("returns upstream error with message", async () => {
    server.use(
      http.post("http://mock-verification-url", () => {
        return HttpResponse.json(
          { message: "Token expired" },
          { status: 422 },
        );
      }),
    );

    const request = mockNextRequest({
      searchParams: { token: "expired-token", username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Token expired");
    expect(data.error).toEqual({ message: "Token expired" });
  });

  it("returns default error message when upstream JSON parse fails", async () => {
    server.use(
      http.post("http://mock-verification-url", () => {
        return new HttpResponse("not json", { status: 500 });
      }),
    );

    const request = mockNextRequest({
      searchParams: { token: "bad-token", username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Email verification failed");
  });

  it("returns 504 on AbortError (timeout)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    const request = mockNextRequest({
      searchParams: { token: "slow-token", username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Email verification request timed out");
  });

  it("returns 500 on other errors", async () => {
    server.use(
      http.post("http://mock-verification-url", () => {
        return HttpResponse.error();
      }),
    );

    const request = mockNextRequest({
      searchParams: { token: "some-token", username: "testuser" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toBe(
      "Internal server error during email verification",
    );
  });
});
