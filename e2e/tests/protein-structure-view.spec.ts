import {
  emptyBackendFallbackOverrides,
  proteinStructureScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { ProteinStructurePage } from "../pages";

const workspacePath = "/e2e-test-user@patricbrc.org/home/model.pdb";

const minimalPdb = [
  "HEADER    E2E WORKSPACE STRUCTURE",
  "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N  ",
  "TER",
  "END",
  "",
].join("\n");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Protein Structure view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/workspace\/view\/e2e-test-user%40patricbrc\.org\/home\/model\.pdb$/,
          method: "GET",
          headers: { "Content-Type": "chemical/x-pdb" },
          body: minimalPdb,
        },
        ...proteinStructureScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("uses the canonical collection request and row link", async ({
    page,
  }) => {
    const proteinStructurePage = new ProteinStructurePage(page);
    const request = await proteinStructurePage.gotoCollection("spike");

    const url = new URL(request.url());
    expect(url.searchParams.get("keyword")).toBe("spike");
    expect(url.searchParams.get("rql")).toBe("eq(pdb_id,*)");
    await proteinStructurePage.expectCollectionRow(
      "6VXX",
      "SARS-CoV-2 spike glycoprotein",
    );
  });

  test("renders a single accession member and requests a mocked Mol* source", async ({
    page,
  }) => {
    const proteinStructurePage = new ProteinStructurePage(page);
    const sourceRequest = page.waitForRequest((request) =>
      /\/(?:api\/structure\/PDB\/6VXX\.pdb|download\/6VXX\.cif)$/.test(
        new URL(request.url()).pathname,
      ),
    );

    await proteinStructurePage.gotoAccessions("6VXX");
    await proteinStructurePage.expectMember(
      "6VXX",
      "SARS-CoV-2 spike glycoprotein",
    );
    await sourceRequest;
    await expect(page).toHaveURL("/protein-structure?accession=6VXX");
  });

  test("provides an accessible selector for multiple accessions", async ({
    page,
  }) => {
    const proteinStructurePage = new ProteinStructurePage(page);
    await proteinStructurePage.gotoAccessions("6VXX", "7BV2");

    const selector = proteinStructurePage.accessionSelector();
    await expect(selector).toBeVisible();
    await expect(
      selector.getByRole("button", { name: "6VXX", exact: true }),
    ).toBeVisible();
    await selector.getByRole("button", { name: "7BV2", exact: true }).click();
    await proteinStructurePage.expectMember("7BV2");
  });

  test("rejects combined accession and workspace path state", async ({
    page,
  }) => {
    const proteinStructurePage = new ProteinStructurePage(page);
    await page.goto(
      `/protein-structure?accession=6VXX&path=${encodeURIComponent(workspacePath)}`,
    );
    await proteinStructurePage.expectInvalid(
      "Protein structure accession and workspace path are mutually exclusive.",
    );
  });

  test("redirects legacy list and hash URLs to canonical routes", async ({
    page,
  }) => {
    const proteinStructurePage = new ProteinStructurePage(page);
    await proteinStructurePage.expectLegacyListRedirect("keyword=spike");
    await proteinStructurePage.expectLegacyHashRedirect("6VXX");
    await proteinStructurePage.expectMember("6VXX");
  });

  test("keeps the member viewer contained on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const proteinStructurePage = new ProteinStructurePage(page);
    await proteinStructurePage.gotoAccessions("6VXX", "7BV2");
    await proteinStructurePage.expectMember("6VXX");

    const bounds = await page.getByTestId("molstar-container").boundingBox();
    if (!bounds) throw new Error("Mol* container has no bounding box");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("loads a workspace path without leaking to a backend host", async ({
    page,
  }) => {
    const backendRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/patricbrc\.org|bv-brc\.org|theseed\.org/i.test(url.hostname)) {
        backendRequests.push(request.url());
      }
    });
    const workspaceRequest = page.waitForRequest((request) =>
      new URL(request.url()).pathname.endsWith(
        "/api/workspace/view/e2e-test-user%40patricbrc.org/home/model.pdb",
      ),
    );

    await page.goto(
      `/protein-structure?path=${encodeURIComponent(workspacePath)}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "model.pdb" }),
    ).toBeVisible();
    await expect(page.getByTestId("molstar-container")).toBeVisible();
    await workspaceRequest;
    expect(backendRequests).toEqual([]);
  });
});
