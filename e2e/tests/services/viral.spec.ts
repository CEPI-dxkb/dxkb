import { test, expect } from "@playwright/test";
import { applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";

interface ServiceCase {
  slug: string;
  title: RegExp;
}

const services: ServiceCase[] = [
  { slug: "sars-cov2-wastewater-analysis", title: /sars-cov-2 wastewater/i },
  { slug: "sars-cov2-genome-analysis", title: /sars-cov-2 genome analysis/i },
  { slug: "influenza-ha-subtype", title: /ha subtype/i },
  { slug: "viral-assembly", title: /viral assembly/i },
  { slug: "subspecies-classification", title: /subspecies classification/i },
];

test.describe("viral-tools services", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...permissiveBackendOverrides,
      ],
    });
  });

  for (const { slug, title } of services) {
    test(`${slug} form renders with h1`, async ({ page }) => {
      await page.goto(`/services/${slug}`);
      await expect(page).not.toHaveURL(/sign-in/);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    });
  }
});
