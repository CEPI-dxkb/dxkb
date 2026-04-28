import type { JourneyDriver } from "../record-har";

/**
 * Drives the sign-in form with the BV-BRC test account from .env.e2e and waits until
 * `/api/auth/sign-in/email` resolves. Captures the real response shape so specs can
 * replay it instead of hand-maintaining a fake user payload.
 *
 * Selectors mirror SignInPage so this driver tracks the real form. Update both
 * together if the form changes.
 */
export const drive: JourneyDriver = async (page, { baseURL, user, password }) => {
  if (!user || !password) {
    throw new Error("E2E_TEST_USER / E2E_TEST_PASSWORD must be set in .env.e2e");
  }

  await page.goto(`${baseURL}/sign-in`);
  const usernameInput = page.getByPlaceholder(/username or email/i);
  const passwordInput = page.getByPlaceholder(/enter your password/i);
  await usernameInput.waitFor({ state: "visible", timeout: 30_000 });

  // The submit button text flips from "Signing in..." (auth store hydrating) to
  // "Sign In" (idle). Both placeholders are unique to the sign-in form, so
  // scoping by them avoids the navbar's search submit.
  const signInForm = page.locator("form").filter({ has: usernameInput });
  const submitButton = signInForm.locator('button[type="submit"]').first();
  await submitButton.waitFor({ state: "visible", timeout: 30_000 });
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

  // Let any post-auth redirects + session fetches settle so they land in the HAR too.
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
