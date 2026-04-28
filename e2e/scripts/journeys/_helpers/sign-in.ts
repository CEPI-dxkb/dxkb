import type { Page } from "@playwright/test";

import type { JourneyEnv } from "../../record-har";

/**
 * Drives the sign-in form with the BV-BRC test account and waits until
 * `/api/auth/sign-in/email` resolves and the post-auth network settles.
 *
 * Shared by every signed-in journey driver (`workspace-*`, `jobs-*`,
 * `service-*`). Keeps the auth flow in one place so when the form changes,
 * only this helper needs updating; individual journey drivers stay focused
 * on the surface they capture.
 *
 * Selector strategy mirrors `auth-sign-in.ts` (the bare sign-in journey),
 * which mirrors `SignInPage`. Update all three together if the form changes.
 */
export async function signIn(page: Page, env: JourneyEnv): Promise<void> {
  const { baseURL, user, password } = env;
  if (!user || !password) {
    throw new Error("E2E_TEST_USER / E2E_TEST_PASSWORD must be set in .env.e2e");
  }

  await page.goto(`${baseURL}/sign-in`);
  const usernameInput = page.getByPlaceholder(/username or email/i);
  const passwordInput = page.getByPlaceholder(/enter your password/i);
  await usernameInput.waitFor({ state: "visible", timeout: 30_000 });

  const signInForm = page.locator("form").filter({ has: usernameInput });
  const submitButton = signInForm.locator('button[type="submit"]').first();
  await submitButton.waitFor({ state: "visible", timeout: 30_000 });
  // Wait until the auth boundary has hydrated (button text flips from "Signing in..." → "Sign In").
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('form button[type="submit"]'));
      return buttons.some(
        (b) =>
          b instanceof HTMLButtonElement &&
          !b.disabled &&
          /^sign in$/i.test(b.textContent?.trim() ?? ""),
      );
    },
    null,
    { timeout: 30_000 },
  );

  await usernameInput.fill(user);
  await passwordInput.fill(password);

  const signInResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/sign-in/email") && res.request().method() === "POST",
    { timeout: 30_000 },
  );
  await submitButton.click();
  await signInResponse;

  // Settle post-auth redirects + session fetches so they land in the HAR too.
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
}

/**
 * Read the canonical user id set by sign-in. The `E2E_TEST_USER` env var may
 * be the bare username; the workspace URL needs the realm-qualified id
 * (e.g. `e2e-test-user@patricbrc.org`).
 *
 * `setSession` in `src/lib/auth/session.ts` writes `bvbrc_user_id` from
 * `userProfile.id ?? username.split("@")[0]`. When the BV-BRC profile lacks
 * an `id` field the cookie holds only the bare username, so we re-attach
 * the `bvbrc_realm` cookie value to reconstruct the full id.
 */
export async function getUserId(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const raw = cookies.find((c) => c.name === "bvbrc_user_id")?.value;
  if (!raw) {
    throw new Error(
      "bvbrc_user_id cookie not set after sign-in — sign-in likely failed. " +
        "Check the recorder log above for a 4xx/5xx on /api/auth/sign-in/email.",
    );
  }
  if (raw.includes("@")) return raw;
  const realm = cookies.find((c) => c.name === "bvbrc_realm")?.value;
  if (!realm) {
    throw new Error(
      `bvbrc_user_id cookie ("${raw}") has no realm and bvbrc_realm cookie is missing — ` +
        "cannot construct the workspace URL.",
    );
  }
  return `${raw}@${realm}`;
}
