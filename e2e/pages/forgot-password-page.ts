import { type Page, type Locator } from "@playwright/test";

export class ForgotPasswordPage {
  readonly page: Page;
  readonly usernameOrEmailInput: Locator;
  readonly submitButton: Locator;
  readonly successCardTitle: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    // No `.first()`: a strict-mode failure is the desired signal if a second
    // match ever appears.
    this.usernameOrEmailInput = page
      .getByPlaceholder(/enter your username or email/i)
      .or(page.getByLabel(/username or email/i));
    this.submitButton = page.getByRole("button", { name: /send reset link/i });
    // CardTitle renders as a div, not a heading.
    this.successCardTitle = page.locator('[data-slot="card-title"]', {
      hasText: /check your email/i,
    });
    // getByRole("alert") also matches Next's hidden #__next-route-announcer__.
    this.errorAlert = page.locator('[role="alert"][data-slot="alert"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/forgot-password");
  }

  async fill(usernameOrEmail: string): Promise<void> {
    await this.usernameOrEmailInput.fill(usernameOrEmail);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
