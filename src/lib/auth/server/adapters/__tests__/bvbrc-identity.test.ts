import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import type { ProfilePatch, SignupCredentials } from "@/lib/auth/types";
import {
  authenticate,
  changePassword,
  extractRealmFromToken,
  getProfile,
  impersonateUser,
  registerUser,
  requestPasswordReset,
  sendVerificationEmail,
  updateProfile,
  verifyEmailToken,
} from "../bvbrc-identity";

beforeEach(() => {
  process.env.USER_AUTH_URL = "https://auth.test/auth/";
  process.env.USER_URL = "https://user.test/user/";
  process.env.USER_REGISTER_URL = "https://auth.test/register";
  process.env.USER_PASSWORD_RESET_URL = "https://auth.test/reset";
  process.env.USER_VERIFICATION_URL = "https://auth.test/verify";
  process.env.APP_BASE_URL = "https://dxkb.org";
});

afterEach(() => {
  delete process.env.APP_BASE_URL;
});

const validProfile = {
  id: "canonical-id",
  l_id: "alice",
  email: "a@x",
  email_verified: true,
  first_name: "Alice",
  last_name: "User",
  creation_date: "",
  last_login: "",
  organisms: "",
  reverification: false,
  source: "test",
};

const signupInput = {
  username: "u",
  email: "u@x",
  first_name: "U",
  last_name: "X",
  password: "p",
  password_repeat: "p",
};

const operationContracts: {
  name: string;
  method: string;
  url: string;
  invoke: () => Promise<unknown>;
  response: () => Response;
}[] = [
  {
    name: "authenticate",
    method: "POST",
    url: "https://auth.test/auth/",
    invoke: () => authenticate({ username: "u", password: "p" }),
    response: () => new HttpResponse(null, { headers: { Authorization: "t" } }),
  },
  {
    name: "registerUser",
    method: "POST",
    url: "https://auth.test/register",
    invoke: () => registerUser(signupInput),
    response: () => new HttpResponse("t"),
  },
  {
    name: "impersonateUser",
    method: "POST",
    url: "https://auth.test/auth/sulogin",
    invoke: () => impersonateUser("admin", "target", "p"),
    response: () => new HttpResponse("t"),
  },
  {
    name: "getProfile",
    method: "GET",
    url: "https://user.test/user/u",
    invoke: () => getProfile("u", "t"),
    response: () => HttpResponse.json(validProfile),
  },
  {
    name: "updateProfile",
    method: "POST",
    url: "https://user.test/user/u",
    invoke: () => updateProfile("u", "t", []),
    response: () => new HttpResponse(null, { status: 204 }),
  },
  {
    name: "requestPasswordReset",
    method: "POST",
    url: "https://auth.test/reset",
    invoke: () => requestPasswordReset("u@x"),
    response: () => new HttpResponse(null, { status: 204 }),
  },
  {
    name: "sendVerificationEmail",
    method: "POST",
    url: "https://auth.test/verify",
    invoke: () => sendVerificationEmail("u", "t"),
    response: () => new HttpResponse(null, { status: 204 }),
  },
  {
    name: "verifyEmailToken",
    method: "POST",
    url: "https://auth.test/verify",
    invoke: () => verifyEmailToken("verification-token", "u"),
    response: () => new HttpResponse(null, { status: 204 }),
  },
  {
    name: "changePassword",
    method: "POST",
    url: "https://user.test/user/",
    invoke: () => changePassword("u", "t", "old", "new"),
    response: () => HttpResponse.json({ result: true }),
  },
];

describe("named BV-BRC identity operations", () => {
  it.each(operationContracts)(
    "$name uses the configured URL, method, and user-agent",
    async ({ method, url, invoke, response }) => {
      let requestSeen: Request | undefined;
      server.use(
        http.all(url, ({ request }) => {
          requestSeen = request;
          return response();
        }),
      );

      await invoke();

      expect(requestSeen?.method).toBe(method);
      expect(requestSeen?.headers.get("User-Agent")).toMatch(/^curl\//);
    },
  );
  it("authenticates with form data, user-agent, and header token", async () => {
    let requestSeen: Request | undefined;
    server.use(
      http.post("https://auth.test/auth/", ({ request }) => {
        requestSeen = request;
        return new HttpResponse("body", {
          headers: { Authorization: "header" },
        });
      }),
    );
    expect(
      (await authenticate({ username: "u", password: "p" })).data?.token,
    ).toBe("header");
    expect(await requestSeen?.text()).toBe("username=u&password=p");
  });

  it("falls back to a trimmed response-body auth token", async () => {
    server.use(
      http.post(
        "https://auth.test/auth/",
        () => new HttpResponse("  body-token\n"),
      ),
    );
    expect((await authenticate({ username: "u", password: "p" })).data).toEqual(
      { token: "body-token" },
    );
  });

  it("maps credential failures separately from validation and outages", async () => {
    server.use(
      http.post("https://auth.test/auth/", () =>
        HttpResponse.json({ message: "secret\ntrace" }, { status: 401 }),
      ),
    );
    expect(
      (await authenticate({ username: "u", password: "bad" })).error,
    ).toMatchObject({
      code: "invalid_credentials",
      message: "Authentication failed",
      status: 401,
    });
  });

  it("joins trailing URLs safely and sends raw authorization", async () => {
    let authorization: string | null = null;
    server.use(
      http.get("https://user.test/user/alice", ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json(validProfile);
      }),
    );
    expect((await getProfile("alice", "raw-token")).data?.id).toBe(
      "canonical-id",
    );
    expect(authorization).toBe("raw-token");
  });

  it("normalizes date fields from the BV-BRC profile response", async () => {
    server.use(
      http.get("https://user.test/user/alice", () =>
        HttpResponse.json({
          ...validProfile,
          creation_date: undefined,
          last_login: undefined,
          creationDate: "2026-01-01T00:00:00Z",
          lastLogin: "2026-01-02T00:00:00Z",
        }),
      ),
    );

    expect((await getProfile("alice", "t")).data).toMatchObject({
      creation_date: "2026-01-01T00:00:00Z",
      last_login: "2026-01-02T00:00:00Z",
    });
  });

  it("rejects malformed profile JSON as an upstream failure", async () => {
    server.use(
      http.get("https://user.test/user/alice", () =>
        HttpResponse.json({ id: "alice" }),
      ),
    );
    expect((await getProfile("alice", "t")).error).toMatchObject({
      code: "service_unavailable",
      status: 502,
    });
  });

  it("updates an encoded profile URL with JSON Patch and a raw auth token", async () => {
    process.env.USER_URL = "https://user.test/user///";
    let requestSeen: Request | undefined;
    const patches: ProfilePatch[] = [
      { op: "replace", path: "/first_name", value: "Alicia" },
    ];
    server.use(
      http.post("https://user.test/user/alice%2Fadmin", ({ request }) => {
        requestSeen = request;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    expect(await updateProfile("alice/admin", "raw-token", patches)).toEqual({
      data: undefined,
      error: null,
    });
    expect(requestSeen?.headers.get("Authorization")).toBe("raw-token");
    expect(requestSeen?.headers.get("Content-Type")).toBe(
      "application/json-patch+json",
    );
    expect(await requestSeen?.json()).toEqual(patches);
  });

  it("sends verification requests with their distinct bodies and auth policy", async () => {
    const requests: Request[] = [];
    server.use(
      http.post("https://auth.test/verify", ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await sendVerificationEmail("canonical-id", "raw-token");
    await verifyEmailToken("email-token", "alice");

    expect(requests[0].headers.get("Authorization")).toBe("raw-token");
    expect(await requests[0].json()).toEqual({ id: "canonical-id" });
    expect(requests[1].headers.has("Authorization")).toBe(false);
    expect(await requests[1].json()).toEqual({
      token: "email-token",
      username: "alice",
    });
  });

  async function registrationBody(
    input: SignupCredentials = signupInput,
  ): Promise<URLSearchParams> {
    let body = "";
    server.use(
      http.post("https://auth.test/register", async ({ request }) => {
        body = await request.text();
        return new HttpResponse("t");
      }),
    );
    expect((await registerUser(input)).data).toEqual({ token: "t" });
    return new URLSearchParams(body);
  }

  it("declares APP_BASE_URL as the registration site, normalized to its origin", async () => {
    process.env.APP_BASE_URL = "https://Dev.DXKB.org:443/services/";
    const body = await registrationBody();
    expect(body.get("registration_site_url")).toBe("https://dev.dxkb.org");
  });

  it("never forwards a registration site supplied by the caller", async () => {
    const body = await registrationBody({
      ...signupInput,
      registration_site_url: "https://www.bv-brc.org",
    } as SignupCredentials);
    expect(body.getAll("registration_site_url")).toEqual(["https://dxkb.org"]);
  });

  it.each([
    ["missing", "", "Missing required environment variable: APP_BASE_URL"],
    [
      "malformed",
      "javascript:alert(1)",
      'APP_BASE_URL must be an absolute http(s) URL, got "javascript:alert(1)"',
    ],
  ])("refuses to register with a %s APP_BASE_URL", async (_name, value, message) => {
    process.env.APP_BASE_URL = value;
    let requested = false;
    server.use(
      http.post("https://auth.test/register", () => {
        requested = true;
        return new HttpResponse("t");
      }),
    );
    await expect(registerUser(signupInput)).rejects.toThrow(message);
    expect(requested).toBe(false);
  });

  it.each([
    ["400 verification", 400, "validation", () => verifyEmailToken("bad", "u")],
    [
      "401 verification send",
      401,
      "unauthorized",
      () => sendVerificationEmail("u", "t"),
    ],
    ["403 profile", 403, "unauthorized", () => getProfile("u", "t")],
    ["404 profile", 404, "not_found", () => getProfile("u", "t")],
    ["409 registration", 409, "conflict", () => registerUser(signupInput)],
    ["429 reset", 429, "rate_limited", () => requestPasswordReset("u@x")],
    [
      "503 password change",
      503,
      "service_unavailable",
      () => changePassword("u", "t", "old", "new"),
    ],
  ] as const)("maps %s", async (_name, status, code, invoke) => {
    server.use(http.all("*", () => new HttpResponse("upstream", { status })));
    expect((await invoke()).error).toMatchObject({ code, status });
  });

  it("does not collapse impersonation rate limiting into invalid credentials", async () => {
    server.use(
      http.post(
        "https://auth.test/auth/sulogin",
        () => new HttpResponse(null, { status: 429 }),
      ),
    );
    expect((await impersonateUser("admin", "target", "pw")).error?.code).toBe(
      "rate_limited",
    );
  });

  it("maps password HTTP 401 to unauthorized and RPC errors to validation", async () => {
    server.use(
      http.post(
        "https://user.test/user/",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    expect((await changePassword("u", "t", "old", "new")).error?.code).toBe(
      "unauthorized",
    );
    server.use(
      http.post("https://user.test/user/", () =>
        HttpResponse.json({ error: { message: "bad password" } }),
      ),
    );
    expect((await changePassword("u", "t", "old", "new")).error?.code).toBe(
      "validation",
    );
  });

  it("distinguishes request timeouts from network failures", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    const pending = authenticate({ username: "u", password: "p" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).error).toMatchObject({
      code: "service_unavailable",
      status: 504,
      message: "Authentication service unavailable timed out",
    });

    vi.useRealTimers();
    fetchSpy.mockRejectedValueOnce(new Error("connection refused"));
    expect(
      (await authenticate({ username: "u", password: "p" })).error,
    ).toEqual({
      code: "network",
      status: 502,
      message: "Authentication service unavailable",
    });
    fetchSpy.mockRestore();
  });

  it.each([
    ["token|un=alice@bvbrc", "bvbrc"],
    ["un=alice", undefined],
    ["token-without-user", undefined],
  ])("extracts the realm from %s", (token, realm) => {
    expect(extractRealmFromToken(token)).toBe(realm);
  });
});
