import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

const viewerFixtureItems = [
  {
    name: "config.json",
    type: "json",
    parentPath: e2eHomePath,
    size: 24,
  },
  {
    name: "sample.fa",
    type: "feature_dna_fasta",
    parentPath: e2eHomePath,
    size: 48,
  },
  {
    name: "diagram.png",
    type: "png",
    parentPath: e2eHomePath,
    size: 128,
  },
];

test.describe("workspace viewer", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Overrides are evaluated first-match-wins, so these specific view URLs MUST come
        // before `buildWorkspaceOverrides` (which registers a catch-all `/api/workspace/view/`).
        {
          url: /\/api\/workspace\/view\/.*config\.json/,
          method: "GET",
          body: '{"hello":"world"}',
          headers: { "Content-Type": "application/json" },
        },
        {
          url: /\/api\/workspace\/view\/.*sample\.fa/,
          method: "GET",
          body: ">seq1\nACGTACGT\n",
          headers: { "Content-Type": "text/plain" },
        },
        ...authSessionOverrides,
        ...buildWorkspaceOverrides({
          pathItems: { [e2eHomePath]: viewerFixtureItems },
        }),
        ...permissiveBackendOverrides,
      ],
    });
  });

  test("clicking a .json file opens the JSON viewer and renders contents", async ({ page }) => {
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.selectFile("config.json");

    // The file-viewer header renders the filename + an Open-in-new-tab button.
    await expect(page.getByTitle(/open in new tab/i)).toBeVisible();
    // CodeMirror renders the streamed content into `.cm-content`. We don't assert exact tokens
    // (highlighting swaps character runs) — just that our fixture made it through.
    await expect(page.locator(".cm-content")).toContainText("hello");
  });

  test("clicking a .fa file opens the text viewer with sequence content", async ({ page }) => {
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.selectFile("sample.fa");

    await expect(page.locator(".cm-content")).toContainText(">seq1");
    await expect(page.locator(".cm-content")).toContainText("ACGT");
  });

  test("clicking a .png file opens the image viewer with a valid proxy src", async ({ page }) => {
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.selectFile("diagram.png");

    const img = page.getByAltText("diagram.png");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute(
      "src",
      /\/api\/workspace\/view\/.+diagram\.png$/,
    );
  });
});
