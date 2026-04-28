import { test, expect, applyBackendMocks, bvbrcCookies } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { SignInPage } from "../pages";

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
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await expect(signIn.usernameInput).toBeVisible();
    await expect(signIn.passwordInput).toBeVisible();
    await expect(signIn.submitButton).toBeVisible();
  });

  test("preserves redirect query param", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    const signIn = new SignInPage(page);
    await signIn.goto("/workspace");
    await expect(page).toHaveURL(/redirect=%2Fworkspace/);
  });

  test("short password shows zod validation error", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
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
        ...permissiveBackendOverrides,
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
    await expect(page).toHaveURL(/\/forgot-password$/);
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
        ...permissiveBackendOverrides,
      ],
    });
    const signIn = new SignInPage(page);
    await signIn.goto();
    await signIn.fill("e2e-test-user", "wrong-password");
    await signIn.submit();
    await signIn.expectInlineError(/invalid username or password/i);
  });

  test("forgot-password page loads", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("sign-up page loads", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/sign-up/);
  });

  test("unauthenticated visit to /workspace redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    await page.goto("/workspace");
    await expect(page).toHaveURL(/sign-in\?redirect=/);
  });

  test("unauthenticated visit to /jobs redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    await page.goto("/jobs");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unauthenticated visit to /settings redirects to sign-in", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [signedOutGetSession, ...permissiveBackendOverrides],
    });
    await page.goto("/settings");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("auth (signed in)", () => {
  test("signs out via avatar dropdown and POSTs /api/auth/sign-out", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...permissiveBackendOverrides,
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
