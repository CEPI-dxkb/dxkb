import {
  expect,
  type Page,
  type Locator,
  type Response,
} from "@playwright/test";
import { encodeQueryComponent } from "@/lib/url";

/**
 * Page object for the /sign-in route. Wraps the form selectors and the common
 * interactions (fill, submit, assert errors) so specs describe intent rather
 * than selector plumbing.
 */
export class SignInPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly heading: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    // Text and placeholder locators need `visible: true`: while the page
    // streams in, React's hidden staging copy (div[hidden]#S:n) of the form
    // can sit beside the rendered one, and a strict-mode violation fails the
    // assertion at once instead of retrying. Role locators skip hidden
    // subtrees already. Seen in WebKit on `?redirect=` visits.
    this.usernameInput = page
      .getByPlaceholder(/username or email/i)
      .filter({ visible: true });
    this.passwordInput = page
      .getByPlaceholder(/enter your password/i)
      .filter({ visible: true });
    this.submitButton = page.getByRole("button", { name: /^sign in$/i });
    this.heading = page.getByText(/sign in to dxkb/i).filter({ visible: true });
    // Scope to the shadcn Alert component; getByRole("alert") also matches
    // Next.js's hidden #__next-route-announcer__ and triggers strict-mode failures.
    this.alert = page.locator('[role="alert"][data-slot="alert"]');
  }

  async goto(redirect?: string, baseURL = ""): Promise<void> {
    const path = redirect
      ? `/sign-in?redirect=${encodeURIComponent(redirect)}`
      : "/sign-in";
    await this.page.goto(`${baseURL}${path}`);
    await expect(this.heading).toBeVisible();
  }

  /**
   * Visit a protected `path` without a session and assert the proxy sends it
   * here, carrying `path` as the post-sign-in redirect target.
   */
  async gotoProtected(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.page).toHaveURL(
      `/sign-in?redirect=${encodeQueryComponent(path)}`,
    );
    await expect(this.heading).toBeVisible();
  }

  async waitUntilInteractive(timeout = 30_000): Promise<void> {
    await this.submitButton.waitFor({ state: "visible", timeout });
    await expect(this.submitButton).toBeEnabled({ timeout });
  }

  async fill(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async submitAndWaitForResponse(timeout = 30_000): Promise<Response> {
    const response = this.page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === "/api/auth/sign-in/email" &&
        candidate.request().method() === "POST",
      { timeout },
    );
    await this.submit();
    return response;
  }

  async expectInlineError(text: string | RegExp): Promise<void> {
    await expect(this.alert).toContainText(text);
  }

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
