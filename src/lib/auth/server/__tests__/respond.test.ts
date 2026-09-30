import type { AuthUser } from "@/lib/auth/types";
import {
  clearTestCookies,
  setTestSession,
  testCookieStore,
} from "@/test-helpers/api-route-helpers";
import {
  respondWithAck,
  respondWithSession,
  respondWithSessionMutation,
  respondWithUpstreamFailure,
} from "../respond";

const user: AuthUser = { id: "alice-id", username: "alice", email: "a@x" };

describe("session responses", () => {
  it("uses the exact cookie-write expiry and redacts the token", async () => {
    const expiresAt = 1_800_000_000_000;
    const response = respondWithSession({ data: user, error: null }, expiresAt);
    expect(await response.json()).toEqual({
      user,
      session: { token: "", expiresAt: new Date(expiresAt).toISOString() },
    });
  });

  it("adapts a session mutation and redacts the token", async () => {
    const expiresAt = 1_800_000_000_000;
    const response = respondWithSessionMutation({
      data: { user, expiresAt },
      error: null,
    });

    await expect(response.json()).resolves.toEqual({
      user,
      session: { token: "", expiresAt: new Date(expiresAt).toISOString() },
    });
  });

  it("does not fabricate expiry for a user response", () => {
    expect(() => respondWithSession({ data: user, error: null })).toThrow(
      "expiresAt is required",
    );
  });

  it("allows a guest envelope without expiry", async () => {
    const response = respondWithSession({ data: null, error: null });
    await expect(response.json()).resolves.toEqual({
      user: null,
      session: null,
    });
  });

  it("uses the common error response branch", async () => {
    const result = {
      data: null,
      error: {
        code: "rate_limited" as const,
        message: "slow down",
        status: 429,
      },
    };
    const sessionResponse = respondWithSession(result);
    const ackResponse = respondWithAck(result);
    expect(sessionResponse.status).toBe(429);
    expect(await sessionResponse.json()).toEqual({
      error: "slow down",
      code: "validation",
    });
    expect(await ackResponse.json()).toEqual({
      error: "slow down",
      code: "validation",
    });
  });
});

describe("respondWithUpstreamFailure", () => {
  beforeEach(() => {
    clearTestCookies();
    setTestSession({ token: "the-token", userId: "user1" });
  });

  it("ends the session when the upstream rejects its token", async () => {
    const response = await respondWithUpstreamFailure({
      code: "unauthorized",
      message: "Profile lookup failed",
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Profile lookup failed",
      code: "session_expired",
    });
    expect(testCookieStore.get("bvbrc_token")).toBeUndefined();
  });

  it("keeps the session for any other failure", async () => {
    const response = await respondWithUpstreamFailure({
      code: "service_unavailable",
      message: "Profile service unavailable",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Profile service unavailable",
      code: "upstream",
    });
    expect(testCookieStore.get("bvbrc_token")).toStrictEqual({
      name: "bvbrc_token",
      value: "the-token",
    });
  });
});
