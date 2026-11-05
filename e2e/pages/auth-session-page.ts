import { expect, type Page, type Locator } from "@playwright/test";

export class AuthSessionPage {
  readonly page: Page;
  readonly userMenuTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userMenuTrigger = page.getByRole("button", { name: "Account menu" });
  }

  async expectSignedIn(): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: /^sign in$/i }),
    ).toHaveCount(0);
    await expect(
      this.page.getByRole("link", { name: /^sign up$/i }),
    ).toHaveCount(0);
    await expect(this.userMenuTrigger).toBeVisible();
  }

  async signOut(): Promise<void> {
    await this.userMenuTrigger.click();
    await this.page
      .getByRole("button", { name: /^sign out$/i })
      .first()
      .click();
    await this.page
      .getByRole("button", { name: /^sign out$/i })
      .last()
      .click();
  }

  async startImpersonation(
    targetUser: string,
    password: string,
  ): Promise<void> {
    await this.userMenuTrigger.click();
    await this.page.getByText("SU Login", { exact: true }).click();
    await expect(
      this.page.getByRole("dialog", { name: "SU Login" }),
    ).toBeVisible();
    await this.page.getByLabel("User to Impersonate").fill(targetUser);
    await this.page.getByLabel("Your Password").fill(password);
    await this.page.getByRole("button", { name: "Take Control" }).click();
  }

  async expectImpersonating(username: string): Promise<void> {
    await expect(
      this.page
        .getByText(`You are impersonating ${username}.`, { exact: true })
        .first(),
    ).toBeVisible();
  }

  async expectUserGreeting(username: string): Promise<void> {
    await this.userMenuTrigger.click();
    await expect(
      this.page.getByText(`Hello, ${username}!`, { exact: true }),
    ).toBeVisible();
  }

  async exitImpersonation(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.page.getByRole("button", { name: "Exit SU" }).first().click();
    await expect(
      this.page.getByText("You are impersonating", { exact: false }).first(),
    ).toBeHidden();
  }

  async expectSuLoginAvailable(): Promise<void> {
    await expect(
      this.page.getByText("SU Login", { exact: true }),
    ).toBeVisible();
  }
}
