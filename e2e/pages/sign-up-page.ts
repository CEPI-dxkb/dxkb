import { type Page, type Locator } from "@playwright/test";

/**
 * Page object for the /sign-up route. Wraps the form selectors and common
 * interactions (fill all required fields, submit, assert outcome) so specs
 * describe intent rather than selector plumbing.
 *
 * Selector notes:
 * - `RequiredFormLabel` renders a plain <Label> (no htmlFor), so getByLabel()
 *   cannot associate it with the sibling input. We use input[name="..."] to
 *   target each field precisely by its TanStack Form field name.
 * - Both password inputs share the placeholder "Enter a password", so name-based
 *   selectors are the only reliable way to distinguish them.
 * - successToast targets the sonner portal element (outside the page's main DOM).
 * - errorAlert targets the shadcn <Alert> via data-slot="alert".
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
    // Required fields — keyed by their TanStack Form field name (== input name attr)
    this.firstNameInput = page.locator('input[name="first_name"]');
    this.lastNameInput = page.locator('input[name="last_name"]');
    this.usernameInput = page.locator('input[name="username"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    // password_repeat distinguishes "Confirm password" from the primary password field
    this.passwordRepeatInput = page.locator('input[name="password_repeat"]');
    // Button label is "Create account" (static text; "Creating account..." when loading)
    this.submitButton = page.getByRole("button", { name: /^create account$/i });
    // Sonner toast renders into a portal with data-sonner-toast on each toast element
    this.successToast = page.locator("[data-sonner-toast]", {
      hasText: /account created successfully/i,
    });
    // shadcn Alert component carries data-slot="alert" on its root element.
    // Scope to the destructive variant (role="alert") so informational alerts
    // elsewhere on the page don't false-match. Mirrors sign-in-page.ts.
    this.errorAlert = page.locator('[role="alert"][data-slot="alert"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/sign-up");
    // The form is rendered inside <Suspense>; wait for the submit button to
    // appear before returning so callers can interact without racing the
    // loading skeleton.
    await this.submitButton.waitFor({ state: "visible" });
  }

  async fillRequired(values: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    /** Defaults to `password` so the schema's refine equality check passes.
     * Override to drive the "passwords do not match" validation path. */
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
