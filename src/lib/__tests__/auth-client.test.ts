import {
  signInEmail,
  signUpEmail,
  signOut,
  requestPasswordReset,
  sendVerificationEmail,
  getSessionWithUser,
} from "@/lib/auth-client";

describe("auth-client", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("signInEmail", () => {
    it("posts to /api/auth/sign-in/email with credentials and returns data on success", async () => {
      const responseData = {
        user: { username: "testuser", email: "test@example.com", token: "abc" },
        session: { token: "sess-token", expiresAt: "2026-12-31" },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(responseData),
      });

      const result = await signInEmail({
        username: "testuser",
        password: "pass123",
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ username: "testuser", password: "pass123" }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual({ data: responseData, error: null });
    });

    it("returns { data: null, error } on HTTP error with status code", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi
          .fn()
          .mockResolvedValue({ message: "Invalid credentials" }),
      });

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
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const result = await signInEmail({
        username: "user",
        password: "pass",
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: "Network failure" });
    });

    it("uses fallback error message when response body cannot be parsed", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error("parse error")),
      });

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
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });

      await signInEmail({ username: "u", password: "p" });

      expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
    });
  });

  describe("signUpEmail", () => {
    it("posts to /api/auth/sign-up/email", async () => {
      const signupData = {
        user: { username: "newuser", email: "new@example.com", token: "t" },
        session: { token: "s", expiresAt: "2026-12-31" },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(signupData),
      });

      const credentials = {
        email: "new@example.com",
        username: "newuser",
        first_name: "New",
        last_name: "User",
        password: "pass123",
        password_repeat: "pass123",
      };

      const result = await signUpEmail(credentials);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify(credentials),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual({ data: signupData, error: null });
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({ message: "Username taken" }),
      });

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
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const result = await signOut();

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual({ data: { success: true }, error: null });
    });

    it("includes credentials: 'include'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      await signOut();

      expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
    });
  });

  describe("requestPasswordReset", () => {
    it("posts to /api/auth/forget-password", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, message: "Email sent" }),
      });

      const result = await requestPasswordReset({
        usernameOrEmail: "user@example.com",
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/forget-password", {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail: "user@example.com" }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual({
        data: { success: true, message: "Email sent" },
        error: null,
      });
    });
  });

  describe("sendVerificationEmail", () => {
    it("posts to /api/auth/send-verification-email", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({
            success: true,
            message: "Verification email sent",
          }),
      });

      const result = await sendVerificationEmail();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/send-verification-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
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
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(sessionData),
      });

      const result = await getSessionWithUser();

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/get-session", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual({ data: sessionData, error: null });
    });

    it("includes credentials: 'include'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });

      await getSessionWithUser();

      expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
    });

    it("returns error when session fetch fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ message: "Forbidden" }),
      });

      const result = await getSessionWithUser();

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: "Forbidden", status: 403 });
    });
  });
});
