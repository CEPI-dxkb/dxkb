import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { SignInPage, ForgotPasswordPage, SignUpPage } from "../pages";

test.describe("auth (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in page renders with form fields", async ({ page }) => {
    await applyBackendMocks(page, { overrides: [...journeyOverrides] });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await expect(signIn.usernameInput).toBeVisible();
    await expect(signIn.passwordInput).toBeVisible();
    await expect(signIn.submitButton).toBeVisible();
  });

  test("preserves redirect query param", async ({ page }) => {
    await applyBackendMocks(page, { overrides: [...journeyOverrides] });
    const signIn = new SignInPage(page);
    await signIn.goto("/workspace");
    await expect(page).toHaveURL(/redirect=%2Fworkspace/);
  });

  test("allows a one-character legacy password", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
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

    const signInRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/sign-in/email") &&
        req.method() === "POST",
    );
    await signIn.fill("legacy@example.com", "p");
    await signIn.submit();
    expect((await signInRequest).postDataJSON()).toMatchObject({
      username: "legacy@example.com",
      password: "p",
    });
  });

  test("submits the canonical sign-in request", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
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
            session: { token: "", expiresAt: "2099-01-01T00:00:00Z" },
          },
        },
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const signIn = new SignInPage(page);
    await signIn.goto("/forgot-password");

    const signInRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/sign-in/email") &&
        req.method() === "POST",
    );
    await signIn.fill("e2e-test-user", "password1234");
    await signIn.submit();
    const req = await signInRequest;
    expect(req.postDataJSON()).toMatchObject({
      username: "e2e-test-user",
      password: "password1234",
    });
  });

  test("surfaces backend error on invalid credentials", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
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

  test("forgot-password submits the identifier and shows confirmation", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
          url: "/api/auth/forget-password",
          method: "POST",
          body: {
            success: true,
            message: "Password reset email sent successfully",
          },
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
    expect((await forgetRequest).postDataJSON()).toEqual({
      usernameOrEmail: "e2e@example.com",
    });
    await expect(forgot.successCardTitle).toBeVisible();
  });

  test("forgot-password surfaces the generic error when the reset call fails", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
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
    await expect(forgot.errorAlert).toBeVisible();
  });

  test("sign-up submits required fields and shows success", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
          url: "/api/auth/sign-up/email",
          method: "POST",
          body: {
            user: {
              id: "new-user@patricbrc.org",
              username: "new-user@patricbrc.org",
              email: "new@example.com",
              email_verified: false,
            },
            session: { token: "", expiresAt: "2099-01-01T00:00:00Z" },
          },
        },
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
    expect((await signUpRequest).postDataJSON()).toMatchObject({
      email: "new@example.com",
      username: "new-user",
      first_name: "Eve",
      last_name: "Tester",
      password: "password1234",
      password_repeat: "password1234",
    });
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });

  test("sign-up surfaces the upstream error message on conflict", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
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
    await expect(
      page.locator('[data-slot="alert"]').getByText(/username already taken/i),
    ).toBeVisible();
  });

  test("unauthenticated visit to /workspace redirects to sign-in", async ({
    page,
  }) => {
    await applyBackendMocks(page, { overrides: [...journeyOverrides] });
    await page.goto("/workspace");
    await expect(page).toHaveURL(/sign-in\?redirect=/);
  });
});
