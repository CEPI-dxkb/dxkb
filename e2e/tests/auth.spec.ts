import { test, expect, applyBackendMocks, bvbrcCookies } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { SignInPage, ForgotPasswordPage, SignUpPage } from "../pages";

const signedOutGetSession = {
  url: "/api/auth/get-session",
  method: "GET",
  status: 200,
  body: { user: null, session: null },
} as const;

test.describe("auth (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in page renders with form fields", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await expect(signIn.usernameInput).toBeVisible();
    await expect(signIn.passwordInput).toBeVisible();
    await expect(signIn.submitButton).toBeVisible();
  });

  test("preserves redirect query param", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    const signIn = new SignInPage(page);
    await signIn.goto("/workspace");
    await expect(page).toHaveURL(/redirect=%2Fworkspace/);
  });

  test("short password shows zod validation error", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await signIn.fill("e2e@example.com", "short");
    await signIn.submit();
    await signIn.expectValidationError(/at least 8 characters/i);
  });

  test("submits credentials and redirects to target on success", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          url: "/api/auth/sign-in/email",
          method: "POST",
          body: {
            user: {
              id: "e2e-test-user@patricbrc.org",
              username: "e2e-test-user@patricbrc.org",
              email: "e2e@example.com",
              email_verified: true,
            },
            session: { token: "e2e-test-token", expiresAt: "2099-01-01T00:00:00Z" },
          },
        },
        // Workspace.get (favorites) and Workspace.ls fire on the post-sign-in landing page.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const signIn = new SignInPage(page);
    await signIn.goto("/forgot-password");

    const signInRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/sign-in/email") && req.method() === "POST",
    );
    await signIn.fill("e2e-test-user", "password1234");
    await signIn.submit();
    const req = await signInRequest;
    expect(req.postDataJSON()).toMatchObject({
      username: "e2e-test-user",
      password: "password1234",
    });
    // After sign-in, the sign-in page pushes the redirect target (/forgot-password).
    // /forgot-password hardcodes its authed-user redirect to "/" (see its useEffect),
    // so the post-signin chain ends at "/". Mirrors the HAR-replay assertion below.
    await expect(page).toHaveURL(/\/$/);
  });

  // Same flow as the test above but driven by the recorded `auth-sign-in.har` instead
  // of a hand-written override. Catches drift between the test fixture and the real
  // BV-BRC sign-in response shape — re-record via `pnpm e2e:record auth-sign-in`
  // when the contract changes (the bi-weekly workflow runs this automatically).
  test("submits credentials via recorded HAR replay", async ({ page }) => {
    // No `permissiveBackendOverrides` here: those have a `/\/api\/auth\//` POST
    // catch-all that would intercept the sign-in call before HAR replay sees it,
    // returning `{}` instead of the recorded session payload. The HAR itself
    // covers `/api/auth/get-session` (signed-out shape) and `/api/auth/sign-in/email`.
    await applyBackendMocks(page, {
      har: "auth-sign-in.har",
    });
    const signIn = new SignInPage(page);
    await signIn.goto();

    const signInResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/auth/sign-in/email") &&
        res.request().method() === "POST",
    );
    await signIn.fill("e2e-test-user", "REDACTED-PASSWORD");
    await signIn.submit();
    const res = await signInResponse;
    const body = await res.json();
    expect(body.user).toMatchObject({
      username: "e2e-test-user",
      realm: "bvbrc",
      email_verified: true,
    });
    expect(body.session).toHaveProperty("expiresAt");
    // Without an explicit `?redirect=...`, the sign-in page pushes to "/" once
    // the store flips to authed. Asserting the post-signin landing URL proves
    // both that the recorded payload was accepted and that the authed-redirect
    // effect fired — i.e. the HAR's user shape unwrapped cleanly.
    await expect(page).toHaveURL(/\/$/);
  });

  test("surfaces backend error on invalid credentials", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          url: "/api/auth/sign-in/email",
          method: "POST",
          status: 401,
          body: { message: "Invalid username or password" },
        },
        ...journeyOverrides,
      ],
    });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await signIn.fill("e2e-test-user", "wrong-password");
    await signIn.submit();
    await signIn.expectInlineError(/invalid username or password/i);
  });

  test("forgot-password submit POSTs the entered identifier and shows the check-your-email card", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          // Successful password reset — server returns { success: true, message: "..." }
          url: "/api/auth/forget-password",
          method: "POST",
          body: { success: true, message: "Password reset email sent successfully" },
        },
        ...journeyOverrides,
      ],
    });
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();
    await forgot.fill("e2e@example.com");

    const forgetRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/forget-password") &&
        req.method() === "POST",
    );
    await forgot.submit();
    const req = await forgetRequest;
    // The HTTP adapter sends `{ usernameOrEmail }`; the route handler also
    // tolerates `email` as a server-side fallback, but the client never uses it.
    const body = req.postDataJSON() as { usernameOrEmail: string };
    expect(body.usernameOrEmail).toBe("e2e@example.com");

    await expect(forgot.successCardTitle).toBeVisible();
  });

  test("forgot-password surfaces the generic error when the reset call fails", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          // Failed password reset — server returns 400 with an error message
          url: "/api/auth/forget-password",
          method: "POST",
          status: 400,
          body: { success: false, message: "User not found" },
        },
        ...journeyOverrides,
      ],
    });
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();
    await forgot.fill("missing@example.com");
    await forgot.submit();
    // The page swallows the upstream message and shows a generic error.
    await expect(forgot.errorAlert).toBeVisible();
  });

  test("sign-up submits all required fields and shows the success toast", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          // Successful sign-up — respondWithSession unwraps the returned user + session.
          url: "/api/auth/sign-up/email",
          method: "POST",
          body: {
            user: {
              id: "new-user@patricbrc.org",
              username: "new-user@patricbrc.org",
              email: "new@example.com",
              email_verified: false,
            },
            session: { token: "new-session", expiresAt: "2099-01-01T00:00:00Z" },
          },
        },
        // The session response sets isAuthenticated = true; the form's useEffect
        // redirects to "/" which fires workspace RPC calls on the home page.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const signUp = new SignUpPage(page);
    await signUp.goto();
    await signUp.fillRequired({
      firstName: "Eve",
      lastName: "Tester",
      username: "new-user",
      email: "new@example.com",
      password: "password1234",
    });

    const signUpRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/sign-up/email") &&
        req.method() === "POST",
    );
    await signUp.submit();
    const req = await signUpRequest;
    // Wire shape is SignupCredentials — snake_case keys match the BV-BRC backend contract.
    expect(req.postDataJSON()).toMatchObject({
      email: "new@example.com",
      username: "new-user",
      first_name: "Eve",
      last_name: "Tester",
      password: "password1234",
      password_repeat: "password1234",
    });

    await expect(signUp.successToast).toBeVisible();
  });

  test("sign-up surfaces the upstream error message on conflict", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        signedOutGetSession,
        {
          // 409 conflict — the page surfaces the upstream message verbatim.
          url: "/api/auth/sign-up/email",
          method: "POST",
          status: 409,
          body: { message: "Username already taken" },
        },
        ...journeyOverrides,
      ],
    });
    const signUp = new SignUpPage(page);
    await signUp.goto();
    await signUp.fillRequired({
      firstName: "Eve",
      lastName: "Tester",
      username: "duplicate-user",
      email: "dup@example.com",
      password: "password1234",
    });
    await signUp.submit();
    // Unlike forgot-password, sign-up surfaces the upstream message (not a generic fallback).
    await expect(
      page.locator('[data-slot="alert"]').getByText(/username already taken/i),
    ).toBeVisible();
  });

  test("unauthenticated visit to /workspace redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    await page.goto("/workspace");
    await expect(page).toHaveURL(/sign-in\?redirect=/);
  });

  test("unauthenticated visit to /jobs redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    await page.goto("/jobs");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unauthenticated visit to /settings redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...journeyOverrides],
    });
    await page.goto("/settings");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("auth (signed in)", () => {
  test("signs out via avatar dropdown and POSTs /api/auth/sign-out", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Workspace.get (favorites) + Workspace.ls fire when /settings loads the workspace sidebar.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/sign-in/);

    const avatarTrigger = page.locator('[data-slot="dropdown-menu-trigger"]').first();
    await avatarTrigger.click();
    const signOutTrigger = page.getByRole("button", { name: /^sign out$/i }).first();
    await expect(signOutTrigger).toBeVisible();
    await signOutTrigger.click();
    const confirmButton = page.getByRole("button", { name: /^sign out$/i }).last();
    const signOutRequest = page.waitForRequest(
      (req) => req.url().endsWith("/api/auth/sign-out") && req.method() === "POST",
    );
    await confirmButton.click();
    await signOutRequest;
  });

  test("session cookies are available on signed-in session", async ({ context }) => {
    const cookies = await context.cookies();
    const names = cookies.map((c) => c.name);
    for (const expected of bvbrcCookies.map((c) => c.name)) {
      expect(names).toContain(expected);
    }
  });
});
