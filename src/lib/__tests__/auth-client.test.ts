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
  describe("signInEmail", () => {
    it("posts to /api/auth/sign-in/email with credentials and returns data on success", async () => {
      const responseData = {
        user: { username: "testuser", email: "test@example.com", token: "abc" },
        session: { token: "sess-token", expiresAt: "2026-12-31" },
      };
      let capturedBody: unknown;
      server.use(
        http.post("*/api/auth/sign-in/email", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(responseData);
        }),
      );

      const result = await signInEmail({
        username: "testuser",
        password: "pass123",
      });

      expect(capturedBody).toEqual({ username: "testuser", password: "pass123" });
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
  });

  describe("signUpEmail", () => {
    it("posts to /api/auth/sign-up/email", async () => {
      const signupData = {
        user: { username: "newuser", email: "new@example.com", token: "t" },
        session: { token: "s", expiresAt: "2026-12-31" },
      };
      let capturedBody: unknown;
      server.use(
        http.post("*/api/auth/sign-up/email", async ({ request }) => {
          capturedBody = await request.json();
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

      expect(capturedBody).toEqual(credentials);
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
    it("posts to /api/auth/sign-out and returns data", async () => {
      server.use(
        http.post("*/api/auth/sign-out", () => {
          return HttpResponse.json({ success: true });
        }),
      );

      const result = await signOut();

      expect(result).toEqual({ data: { success: true }, error: null });
    });
  });

  describe("requestPasswordReset", () => {
    it("posts to /api/auth/forget-password", async () => {
      let capturedBody: unknown;
      server.use(
        http.post("*/api/auth/forget-password", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ success: true, message: "Email sent" });
        }),
      );

      const result = await requestPasswordReset({
        usernameOrEmail: "user@example.com",
      });

      expect(capturedBody).toEqual({ usernameOrEmail: "user@example.com" });
      expect(result).toEqual({
        data: { success: true, message: "Email sent" },
        error: null,
      });
    });
  });

  describe("sendVerificationEmail", () => {
    it("posts to /api/auth/send-verification-email", async () => {
      server.use(
        http.post("*/api/auth/send-verification-email", () => {
          return HttpResponse.json({
            success: true,
            message: "Verification email sent",
          });
        }),
      );

      const result = await sendVerificationEmail();

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
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json(sessionData);
        }),
      );

      const result = await getSessionWithUser();

      expect(result).toEqual({ data: sessionData, error: null });
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
