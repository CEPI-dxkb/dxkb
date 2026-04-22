import { respondWithAck, respondWithSession } from "../respond";
import type { AuthUser } from "@/lib/auth/types";

const aliceUser: AuthUser = {
  id: "alice",
  username: "alice",
  email: "alice@example.com",
  first_name: "Alice",
  last_name: "Wonder",
  email_verified: true,
  realm: "bvbrc.org",
  token: "",
};

describe("respondWithSession", () => {
  it("returns { user, session } envelope with 200 on success", async () => {
    const response = respondWithSession({ data: aliceUser, error: null });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual(aliceUser);
    expect(body.session.token).toBe("");
    expect(typeof body.session.expiresAt).toBe("string");
  });

  it("returns { user: null, session: null } when data is null", async () => {
    const response = respondWithSession({ data: null, error: null });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ user: null, session: null });
  });

  it("maps invalid_credentials to 401 with message", async () => {
    const response = respondWithSession({
      data: null,
      error: { code: "invalid_credentials", message: "bad login" },
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ message: "bad login" });
  });

  it("uses explicit status when provided", async () => {
    const response = respondWithSession({
      data: null,
      error: { code: "validation", message: "bad", status: 422 },
    });
    expect(response.status).toBe(422);
  });

  it("maps forbidden to 403", async () => {
    const response = respondWithSession({
      data: null,
      error: { code: "forbidden", message: "nope" },
    });
    expect(response.status).toBe(403);
  });

  it("maps validation to 400", async () => {
    const response = respondWithSession({
      data: null,
      error: { code: "validation", message: "fix me" },
    });
    expect(response.status).toBe(400);
  });

  it("maps service_unavailable to 503", async () => {
    const response = respondWithSession({
      data: null,
      error: { code: "service_unavailable", message: "down" },
    });
    expect(response.status).toBe(503);
  });
});

describe("respondWithAck", () => {
  it("returns { success: true } on success", async () => {
    const response = respondWithAck({ data: undefined, error: null });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it("returns { message } with mapped status on error", async () => {
    const response = respondWithAck({
      data: null,
      error: { code: "unauthorized", message: "nope" },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "nope" });
  });
});
