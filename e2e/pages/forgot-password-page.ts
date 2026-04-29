import { type Page, type Locator } from "@playwright/test";

/**
 * Page object for the /forgot-password route. Wraps the form selectors and
 * common interactions (fill, submit, assert outcomes) so specs describe intent
 * rather than selector plumbing.
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly usernameOrEmailInput: Locator;
  readonly submitButton: Locator;
  readonly successCardTitle: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    // The input has a placeholder "Enter your username or email"; fall back to
    // the label "Username or email" (rendered by RequiredFormLabel) if needed.
    // No `.first()` — both selectors target the same single input today, and
    // strict-mode failure is the desired signal if a second match ever appears.
    this.usernameOrEmailInput = page
      .getByPlaceholder(/enter your username or email/i)
      .or(page.getByLabel(/username or email/i));
    // Button label is "Send reset link" in the non-loading state.
    this.submitButton = page.getByRole("button", { name: /send reset link/i });
    // CardTitle renders as <div data-slot="card-title">, not a heading element.
    this.successCardTitle = page.locator('[data-slot="card-title"]', {
      hasText: /check your email/i,
    });
    // The page swallows upstream errors and always shows this generic message.
    // Scope to the destructive alert slot to avoid false matches elsewhere.
    this.errorAlert = page
      .locator('[data-slot="alert"]')
      .getByText(/unexpected error occurred/i);
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
