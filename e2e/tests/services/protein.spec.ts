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
  { slug: "proteome-comparison", title: /proteome comparison/i },
  { slug: "gene-protein-tree", title: /gene\s*\/\s*protein tree/i },
  { slug: "msa-snp-analysis", title: /msa\s*&\s*snp/i },
  { slug: "meta-cats", title: /meta-cats/i },
];

test.describe("protein-tools services", () => {
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
