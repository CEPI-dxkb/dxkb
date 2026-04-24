import { test, expect, applyBackendMocks } from "../../mocks/backends";
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
  { slug: "genome-assembly", title: /genome assembly/i },
  { slug: "genome-annotation", title: /genome annotation/i },
  { slug: "variation-analysis", title: /variation analysis/i },
  { slug: "genome-alignment", title: /genome alignment/i },
  { slug: "blast", title: /blast/i },
  { slug: "primer-design", title: /primer design/i },
  { slug: "similar-genome-finder", title: /similar genome finder/i },
];

test.describe("genomics services", () => {
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
