import { applyBackendMocks, expect, test } from "../mocks/backends";
import { permissiveBackendOverrides } from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Taxonomy collection", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, { overrides: [...permissiveBackendOverrides] });
  });

  test("searches Taxa canonically and opens the selected Taxon", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Search type" }).click();
    await page.getByRole("option", { name: "Taxa" }).click();
    await page
      .getByPlaceholder("Search by virus name, protein, gene, or taxonomy...")
      .fill("influenza");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL(/\/taxonomy\?keyword=influenza$/);
    await expect(
      page.getByRole("banner").getByRole("combobox", { name: "Search type" }),
    ).toContainText("Taxa");
    await expect(page.getByRole("banner").getByRole("textbox")).toHaveValue(
      "influenza",
    );
    await expect(page.getByPlaceholder("Search keywords...")).toHaveValue("");

    const row = page.getByRole("row", { name: /Select row 11520/ });
    await expect(row).toBeVisible();
    await row.getByRole("checkbox", { name: "Select row 11520" }).check();
    await expect(
      page.getByRole("heading", { level: 3, name: "Influenza A virus" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /TAXON\s*OVERVIEW/i })).toBeEnabled();
    const services = page.getByRole("button", { name: "SERVICES", exact: true });
    await expect(services).toBeEnabled();
    await services.click();
    await expect(
      page.getByRole("heading", { name: "Use selected Taxa in a service" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "BLAST against selected Taxa" }),
    ).toBeEnabled();
  });

  test("redirects legacy Taxa search URLs", async ({ page }) => {
    await page.goto("/search?type=taxonomy&q=influenza");
    await expect(page).toHaveURL(/\/taxonomy\?keyword=influenza$/);
    await expect(page.getByRole("row", { name: /Select row 11520/ })).toBeVisible();
  });
});
