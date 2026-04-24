import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth journeys", () => {
  test("sign-in page renders with form fields", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByText(/sign in to dxkb/i)).toBeVisible();
    await expect(page.getByPlaceholder(/username or email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("sign-in preserves redirect query param", async ({ page }) => {
    await page.goto("/sign-in?redirect=%2Fworkspace");
    await expect(page).toHaveURL(/redirect=%2Fworkspace/);
    await expect(page.getByText(/sign in to dxkb/i)).toBeVisible();
  });

  test("sign-in with invalid password shows validation error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByPlaceholder(/username or email/i).fill("e2e@example.com");
    await page.getByPlaceholder(/enter your password/i).fill("short");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("forgot-password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/forgot-password/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("sign-up page loads", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/sign-up/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated visit to /workspace redirects to sign-in with redirect param", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page).toHaveURL(/sign-in\?redirect=/);
  });

  test("unauthenticated visit to /jobs redirects to sign-in", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unauthenticated visit to /settings redirects to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/sign-in/);
  });
});
