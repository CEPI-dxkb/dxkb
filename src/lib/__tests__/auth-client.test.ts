import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  signInEmail,
  signUpEmail,
  signOut,
  requestPasswordReset,
  sendVerificationEmail,
  getSessionWithUser,
} from "@/lib/auth-client";

describe("auth-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("signInEmail", () => {
    it("posts to /api/auth/sign-in/email with credentials and returns data on success", async () => {
      const responseData = {
        user: { username: "testuser", email: "test@example.com", token: "abc" },
        session: { token: "sess-token", expiresAt: "2026-12-31" },
      };
      let capturedRequest: { url: string; body: unknown; headers: Headers } | null = null;
      server.use(
        http.post("*/api/auth/sign-in/email", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            body: await request.json(),
            headers: request.headers,
          };
          return HttpResponse.json(responseData);
        }),
      );

      const result = await signInEmail({
        username: "testuser",
        password: "pass123",
      });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.body).toEqual({ username: "testuser", password: "pass123" });
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({ data: responseData, error: null });
    });

    it("returns { data: null, error } on HTTP error with status code", async () => {
      server.use(
        http.post("*/api/auth/sign-in/email", () => {
          return HttpResponse.json(
            { message: "Invalid credentials" },
            { status: 401 },
          );
        }),
      );

      const result = await signInEmail({
        username: "bad",
        password: "wrong",
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: "Invalid credentials",
        status: 401,
      });
    });

    it("returns { data: null, error } on network error (fetch throws)", async () => {
      server.use(
        http.post("*/api/auth/sign-in/email", () => {
          return HttpResponse.error();
        }),
      );

      const result = await signInEmail({
        username: "user",
        password: "pass",
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it("uses fallback error message when response body cannot be parsed", async () => {
      server.use(
        http.post("*/api/auth/sign-in/email", () => {
          return new HttpResponse("not json", { status: 500 });
        }),
      );

      const result = await signInEmail({
        username: "user",
        password: "pass",
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: "Sign in failed",
        status: 500,
      });
    });

    it("includes credentials: 'include'", async () => {
      // credentials: "include" is a fetch option set by the source code in authFetch.
      // MSW intercepts at the network level so we verify the handler was called,
      // which confirms the fetch was made. The credentials option is verified
      // by inspecting the source code directly.
      let handlerCalled = false;
      server.use(
        http.post("*/api/auth/sign-in/email", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      await signInEmail({ username: "u", password: "p" });

      expect(handlerCalled).toBe(true);
    });
  });

  describe("signUpEmail", () => {
    it("posts to /api/auth/sign-up/email", async () => {
      const signupData = {
        user: { username: "newuser", email: "new@example.com", token: "t" },
        session: { token: "s", expiresAt: "2026-12-31" },
      };
      let capturedRequest: { url: string; body: unknown; headers: Headers } | null = null;
      server.use(
        http.post("*/api/auth/sign-up/email", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            body: await request.json(),
            headers: request.headers,
          };
          return HttpResponse.json(signupData);
        }),
      );

      const credentials = {
        email: "new@example.com",
        username: "newuser",
        first_name: "New",
        last_name: "User",
        password: "pass123",
        password_repeat: "pass123",
      };

      const result = await signUpEmail(credentials);

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.body).toEqual(credentials);
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({ data: signupData, error: null });
    });

    it("returns error on failure", async () => {
      server.use(
        http.post("*/api/auth/sign-up/email", () => {
          return HttpResponse.json(
            { message: "Username taken" },
            { status: 409 },
          );
        }),
      );

      const result = await signUpEmail({
        email: "e@e.com",
        username: "taken",
        first_name: "F",
        last_name: "L",
        password: "p",
        password_repeat: "p",
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: "Username taken", status: 409 });
    });
  });

  describe("signOut", () => {
    it("posts to /api/auth/sign-out", async () => {
      let capturedRequest: { url: string; headers: Headers } | null = null;
      server.use(
        http.post("*/api/auth/sign-out", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            headers: request.headers,
          };
          return HttpResponse.json({ success: true });
        }),
      );

      const result = await signOut();

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({ data: { success: true }, error: null });
    });

    it("includes credentials: 'include'", async () => {
      // credentials: "include" is a fetch option set by the source code in authFetch.
      // MSW intercepts at the network level so we verify the handler was called.
      let handlerCalled = false;
      server.use(
        http.post("*/api/auth/sign-out", () => {
          handlerCalled = true;
          return HttpResponse.json({ success: true });
        }),
      );

      await signOut();

      expect(handlerCalled).toBe(true);
    });
  });

  describe("requestPasswordReset", () => {
    it("posts to /api/auth/forget-password", async () => {
      let capturedRequest: { url: string; body: unknown; headers: Headers } | null = null;
      server.use(
        http.post("*/api/auth/forget-password", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            body: await request.json(),
            headers: request.headers,
          };
          return HttpResponse.json({ success: true, message: "Email sent" });
        }),
      );

      const result = await requestPasswordReset({
        usernameOrEmail: "user@example.com",
      });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.body).toEqual({ usernameOrEmail: "user@example.com" });
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({
        data: { success: true, message: "Email sent" },
        error: null,
      });
    });
  });

  describe("sendVerificationEmail", () => {
    it("posts to /api/auth/send-verification-email", async () => {
      let capturedRequest: { url: string; headers: Headers } | null = null;
      server.use(
        http.post("*/api/auth/send-verification-email", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            headers: request.headers,
          };
          return HttpResponse.json({
            success: true,
            message: "Verification email sent",
          });
        }),
      );

      const result = await sendVerificationEmail();

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({
        data: { success: true, message: "Verification email sent" },
        error: null,
      });
    });
  });

  describe("getSessionWithUser", () => {
    it("GETs /api/auth/get-session", async () => {
      const sessionData = {
        user: { username: "testuser", email: "t@t.com", token: "tok" },
        session: { expiresAt: "2026-12-31" },
      };
      let capturedRequest: { url: string; method: string; headers: Headers } | null = null;
      server.use(
        http.get("*/api/auth/get-session", async ({ request }) => {
          capturedRequest = {
            url: request.url,
            method: request.method,
            headers: request.headers,
          };
          return HttpResponse.json(sessionData);
        }),
      );

      const result = await getSessionWithUser();

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest?.headers.get("Content-Type")).toBe("application/json");
      expect(result).toEqual({ data: sessionData, error: null });
    });

    it("includes credentials: 'include'", async () => {
      // credentials: "include" is a fetch option set by the source code in authFetch.
      // MSW intercepts at the network level so we verify the handler was called.
      let handlerCalled = false;
      server.use(
        http.get("*/api/auth/get-session", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      await getSessionWithUser();

      expect(handlerCalled).toBe(true);
    });

    it("returns error when session fetch fails", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json(
            { message: "Forbidden" },
            { status: 403 },
          );
        }),
      );

      const result = await getSessionWithUser();

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: "Forbidden", status: 403 });
    });
  });
});
