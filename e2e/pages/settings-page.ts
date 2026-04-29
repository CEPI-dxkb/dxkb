import { type Page, type Locator } from "@playwright/test";

/**
 * Page object for the /settings route. Wraps the ProfileForm selectors so
 * specs describe intent rather than selector plumbing.
 *
 * Selector notes:
 * - `RequiredFormLabel` renders a plain <Label> (no htmlFor), so getByLabel()
 *   cannot associate it with the sibling input. We use input#<id> to target
 *   each field precisely by its TanStack Form field name (set as the `id`
 *   attribute). The profile form does NOT set the `name` attribute on inputs,
 *   so input[name="..."] selectors will NOT match — use id-based ones instead.
 * - The interests field is a Textarea, not an Input; use textarea#interests.
 * - Save button label is "Save Changes" (becomes "Saving..." while submitting).
 * - Success/error are sonner toasts rendered in a portal outside main DOM.
 */
export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly firstNameInput: Locator;
  readonly middleNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly affiliationInput: Locator;
  readonly organismsInput: Locator;
  readonly interestsTextarea: Locator;
  readonly saveButton: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: /user settings/i });
    // Profile form inputs — keyed by TanStack Form field name (set as `id` attr only)
    this.emailInput = page.locator("input#email");
    this.firstNameInput = page.locator("input#first_name");
    this.middleNameInput = page.locator("input#middle_name");
    this.lastNameInput = page.locator("input#last_name");
    this.affiliationInput = page.locator("input#affiliation");
    this.organismsInput = page.locator("input#organisms");
    // Interests is a Textarea, not an Input
    this.interestsTextarea = page.locator("textarea#interests");
    // Button label is "Save Changes" (static text; "Saving..." when loading)
    this.saveButton = page.getByRole("button", { name: /^save changes$/i });
    // Sonner toast renders into a portal with data-sonner-toast on each toast element
    this.successToast = page.locator("[data-sonner-toast]", {
      hasText: /profile updated successfully/i,
    });
    // Covers both branches of `err?.message || "Failed to update profile."` —
    // the upstream-message path and the catch-all fallback.
    this.errorToast = page.locator("[data-sonner-toast]", {
      hasText: /failed to update profile|profile service unavailable/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/settings");
    // Wait for the form to populate post-skeleton. The save button only renders
    // once the GET /api/auth/profile fetch resolves, mirroring sign-up-page.ts.
    await this.saveButton.waitFor({ state: "visible" });
  }
}
