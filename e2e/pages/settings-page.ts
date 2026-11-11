import { type Page, type Locator } from "@playwright/test";

/**
 * Page object for /settings. The profile form sets `id` but not `name` on
 * inputs, so fields are targeted by `input#<id>` (and `textarea#interests`).
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
    this.emailInput = page.locator("input#email");
    this.firstNameInput = page.locator("input#first_name");
    this.middleNameInput = page.locator("input#middle_name");
    this.lastNameInput = page.locator("input#last_name");
    this.affiliationInput = page.locator("input#affiliation");
    this.organismsInput = page.locator("input#organisms");
    this.interestsTextarea = page.locator("textarea#interests");
    this.saveButton = page.getByRole("button", { name: /^save changes$/i });
    this.successToast = page.locator("[data-sonner-toast]", {
      hasText: /profile updated successfully/i,
    });
    // Covers both the upstream-message path and the catch-all fallback.
    this.errorToast = page.locator("[data-sonner-toast]", {
      hasText: /failed to update profile|profile service unavailable/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/settings");
    // The save button renders only once the profile fetch resolves.
    await this.saveButton.waitFor({ state: "visible" });
  }
}
