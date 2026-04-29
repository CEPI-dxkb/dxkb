import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { bvbrcIdentity } from "../bvbrc-identity";

beforeEach(() => {
  process.env.USER_AUTH_URL = "https://auth.test/auth";
  process.env.USER_URL = "https://user.test/user";
  process.env.USER_REGISTER_URL = "https://auth.test/register";
  process.env.USER_VERIFICATION_URL = "https://auth.test/verify";
  process.env.USER_PASSWORD_RESET_URL = "https://auth.test/reset";
});

afterEach(() => {
  delete process.env.USER_AUTH_URL;
  delete process.env.USER_URL;
  delete process.env.USER_REGISTER_URL;
  delete process.env.USER_VERIFICATION_URL;
  delete process.env.USER_PASSWORD_RESET_URL;
});

describe("bvbrcIdentity().authenticate", () => {
  it("returns the token from the Authorization response header on success", async () => {
    server.use(
      http.post(
        "https://auth.test/auth",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "real-token" },
          }),
      ),
    );

    const result = await bvbrcIdentity().authenticate({
      username: "u",
      password: "p",
    });

    expect(result.error).toBeNull();
    expect(result.data?.token).toBe("real-token");
  });

  it("falls back to the response body when the Authorization header is absent", async () => {
    server.use(
      http.post("https://auth.test/auth", () => new HttpResponse("body-token")),
    );

    const result = await bvbrcIdentity().authenticate({
      username: "u",
      password: "p",
    });

    expect(result.data?.token).toBe("body-token");
  });

  it("returns invalid_credentials on 401", async () => {
    server.use(
      http.post(
        "https://auth.test/auth",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const result = await bvbrcIdentity().authenticate({
      username: "u",
      password: "bad",
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalid_credentials");
    expect(result.error?.status).toBe(401);
  });

  it("returns service_unavailable on 500", async () => {
    server.use(
      http.post(
        "https://auth.test/auth",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const result = await bvbrcIdentity().authenticate({
      username: "u",
      password: "p",
    });

    expect(result.error?.code).toBe("service_unavailable");
  });

  it("returns service_unavailable when response is ok but token is empty", async () => {
    server.use(
      http.post("https://auth.test/auth", () => new HttpResponse("   ")),
    );

    const result = await bvbrcIdentity().authenticate({
      username: "u",
      password: "p",
    });

    expect(result.error?.code).toBe("service_unavailable");
  });
});

describe("bvbrcIdentity().validateToken", () => {
  it("returns the profile on 200", async () => {
    server.use(
      http.get("https://user.test/user/myuser", () =>
        HttpResponse.json({ id: "myuser", email: "m@x.com" }),
      ),
    );

    const result = await bvbrcIdentity().validateToken("myuser", "tok");

    expect(result.data).toEqual(
      expect.objectContaining({ id: "myuser", email: "m@x.com" }),
    );
  });

  it("returns unauthorized on 401", async () => {
    server.use(
      http.get(
        "https://user.test/user/myuser",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const result = await bvbrcIdentity().validateToken("myuser", "tok");

    expect(result.error?.code).toBe("unauthorized");
  });

  it("returns service_unavailable on other failures", async () => {
    server.use(
      http.get(
        "https://user.test/user/myuser",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const result = await bvbrcIdentity().validateToken("myuser", "tok");

    expect(result.error?.code).toBe("service_unavailable");
  });

  it("sends the Authorization header", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get("https://user.test/user/myuser", ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ id: "myuser" });
      }),
    );

    await bvbrcIdentity().validateToken("myuser", "my-token");

    expect(capturedAuth).toBe("my-token");
  });
});

describe("bvbrcIdentity().impersonate", () => {
  it("returns the target token on success", async () => {
    server.use(
      http.post(
        "https://auth.test/auth/sulogin",
        () => new HttpResponse("target-token"),
      ),
    );

    const result = await bvbrcIdentity().impersonate("admin", "bob", "pw");

    expect(result.data?.token).toBe("target-token");
  });

  it("returns invalid_credentials on failure", async () => {
    server.use(
      http.post(
        "https://auth.test/auth/sulogin",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const result = await bvbrcIdentity().impersonate("admin", "bob", "bad");

    expect(result.error?.code).toBe("invalid_credentials");
  });

  it("returns invalid_credentials when body is empty", async () => {
    server.use(
      http.post("https://auth.test/auth/sulogin", () => new HttpResponse("")),
    );

    const result = await bvbrcIdentity().impersonate("admin", "bob", "pw");

    expect(result.error?.code).toBe("invalid_credentials");
  });
});

describe("bvbrcIdentity().fetchProfile", () => {
  it("returns the profile when successful", async () => {
    server.use(
      http.get("https://user.test/user/alice", () =>
        HttpResponse.json({ id: "alice", email: "a@x.com" }),
      ),
    );

    const profile = await bvbrcIdentity().fetchProfile("alice", "tok");

    expect(profile).toEqual(
      expect.objectContaining({ id: "alice", email: "a@x.com" }),
    );
  });

  it("returns null on non-200 responses", async () => {
    server.use(
      http.get(
        "https://user.test/user/alice",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    expect(await bvbrcIdentity().fetchProfile("alice", "tok")).toBeNull();
  });

  it("omits Authorization when token is not provided", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get("https://user.test/user/alice", ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ id: "alice" });
      }),
    );

    await bvbrcIdentity().fetchProfile("alice");

    expect(capturedAuth).toBeNull();
  });
});

describe("bvbrcIdentity().requestPasswordReset", () => {
  it("returns ok on success", async () => {
    server.use(
      http.post(
        "https://auth.test/reset",
        () => new HttpResponse(null, { status: 200 }),
      ),
    );

    const result = await bvbrcIdentity().requestPasswordReset("me@example.com");

    expect(result.error).toBeNull();
  });

  it("returns service_unavailable on failure", async () => {
    server.use(
      http.post("https://auth.test/reset", () =>
        HttpResponse.json({ message: "boom" }, { status: 502 }),
      ),
    );

    const result = await bvbrcIdentity().requestPasswordReset("me@example.com");

    expect(result.error?.code).toBe("service_unavailable");
    expect(result.error?.message).toBe("boom");
  });
});

describe("bvbrcIdentity().sendVerificationEmail", () => {
  it("sends POST to USER_VERIFICATION_URL with token + user id", async () => {
    let captured: { auth: string | null; body: unknown } | undefined;
    server.use(
      http.post("https://auth.test/verify", async ({ request }) => {
        captured = {
          auth: request.headers.get("Authorization"),
          body: await request.json(),
        };
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const result = await bvbrcIdentity().sendVerificationEmail("alice", "tok");

    expect(result.error).toBeNull();
    expect(captured?.auth).toBe("tok");
    expect(captured?.body).toEqual({ id: "alice" });
  });

  it("returns service_unavailable on failure", async () => {
    server.use(
      http.post("https://auth.test/verify", () =>
        HttpResponse.json({ message: "no" }, { status: 500 }),
      ),
    );

    const result = await bvbrcIdentity().sendVerificationEmail("alice", "tok");

    expect(result.error?.code).toBe("service_unavailable");
  });
});

describe("bvbrcIdentity().verifyEmailToken", () => {
  it("returns ok on success", async () => {
    server.use(
      http.post("https://auth.test/verify", () =>
        HttpResponse.json({ verified: true }),
      ),
    );

    const result = await bvbrcIdentity().verifyEmailToken("vtok", "alice");

    expect(result.error).toBeNull();
  });

  it("returns validation on failure", async () => {
    server.use(
      http.post("https://auth.test/verify", () =>
        HttpResponse.json({ message: "bad token" }, { status: 400 }),
      ),
    );

    const result = await bvbrcIdentity().verifyEmailToken("vtok", "alice");

    expect(result.error?.code).toBe("validation");
    expect(result.error?.message).toBe("bad token");
  });
});

describe("bvbrcIdentity().changePassword", () => {
  it("sends the JSON-RPC setPassword payload and returns ok on success", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("https://user.test/user/", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: true });
      }),
    );

    const result = await bvbrcIdentity().changePassword(
      "alice",
      "tok",
      "old",
      "new",
    );

    expect(result.error).toBeNull();
    expect(capturedBody).toEqual(
      expect.objectContaining({
        method: "setPassword",
        params: ["alice", "old", "new"],
      }),
    );
  });

  it("returns validation on a JSON-RPC error", async () => {
    server.use(
      http.post("https://user.test/user/", () =>
        HttpResponse.json({
          id: 1,
          jsonrpc: "2.0",
          error: { message: "bad password" },
        }),
      ),
    );

    const result = await bvbrcIdentity().changePassword(
      "alice",
      "tok",
      "old",
      "new",
    );

    expect(result.error?.code).toBe("validation");
  });

  it("returns validation on HTTP failure", async () => {
    server.use(
      http.post(
        "https://user.test/user/",
        () => new HttpResponse("server error", { status: 500 }),
      ),
    );

    const result = await bvbrcIdentity().changePassword(
      "alice",
      "tok",
      "old",
      "new",
    );

    expect(result.error?.code).toBe("validation");
    expect(result.error?.status).toBe(500);
  });
});
