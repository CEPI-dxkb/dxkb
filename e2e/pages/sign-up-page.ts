import { type Page, type Locator } from "@playwright/test";
import { expectHydrated } from "./hydration";

/**
 * Page object for /sign-up. `RequiredFormLabel` has no htmlFor and both
 * password inputs share a placeholder, so fields are targeted by
 * `input[name=...]`.
 */
export class SignUpPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordRepeatInput: Locator;
  readonly submitButton: Locator;
  readonly successToast: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.locator('input[name="first_name"]');
    this.lastNameInput = page.locator('input[name="last_name"]');
    this.usernameInput = page.locator('input[name="username"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.passwordRepeatInput = page.locator('input[name="password_repeat"]');
    this.submitButton = page.getByRole("button", { name: /^create account$/i });
    this.successToast = page.locator("[data-sonner-toast]", {
      hasText: /account created successfully/i,
    });
    // Scoped to the destructive variant (role="alert") so informational
    // alerts do not match.
    this.errorAlert = page.locator('[role="alert"][data-slot="alert"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/sign-up");
    await this.submitButton.waitFor({ state: "visible" });
    // The button is server-rendered before the form hydrates, and a field
    // filled in that window is reset (seen in CI WebKit).
    await expectHydrated(
      this.firstNameInput
        .or(this.lastNameInput)
        .or(this.usernameInput)
        .or(this.emailInput)
        .or(this.passwordInput)
        .or(this.passwordRepeatInput),
      "onChange",
      "the sign-up form's inputs did not hydrate",
    );
  }

  async fillRequired(values: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    /** Defaults to `password` so the schema's equality refine passes. */
    passwordRepeat?: string;
  }): Promise<void> {
    await this.firstNameInput.fill(values.firstName);
    await this.lastNameInput.fill(values.lastName);
    await this.usernameInput.fill(values.username);
    await this.emailInput.fill(values.email);
    await this.passwordInput.fill(values.password);
    await this.passwordRepeatInput.fill(values.passwordRepeat ?? values.password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
