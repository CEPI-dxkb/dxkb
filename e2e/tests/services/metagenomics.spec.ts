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
  { slug: "metagenomic-binning", title: /metagenomic binning/i },
  { slug: "metagenomic-read-mapping", title: /metagenomic read mapping/i },
  { slug: "taxonomic-classification", title: /taxonomic classification/i },
];

test.describe("metagenomics services", () => {
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
