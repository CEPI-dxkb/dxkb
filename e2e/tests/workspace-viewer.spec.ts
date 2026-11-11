import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  journeyOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";
import { recordedTestUserId } from "../scripts/har-constants";
import { harOverridesFor } from "../scripts/har-overrides";

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
        // These view URLs must come before buildWorkspaceOverrides, whose catch-all
        // `/api/workspace/view/` would win (first match).
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
        ...buildWorkspaceOverrides({
          pathItems: { [e2eHomePath]: viewerFixtureItems },
        }),
        ...journeyOverrides,
      ],
    });
  });

  test("clicking a .json file opens the JSON viewer and renders contents", async ({ page }) => {
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.selectFile("config.json");

    await expect(page.getByTitle(/open in new tab/i)).toBeVisible();
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

// Replays workspace-viewer.har; the three Workspace.get entries replay in HAR order via
// callIndex.
test.describe("workspace viewer via recorded HAR replay", () => {
  test("opens readme.txt and renders the recorded file content", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("workspace-viewer.har"),
      ],
    });

    await page.goto(
      `/workspace/${encodeURIComponent(recordedTestUserId)}/home/e2e-fixtures`,
    );

    const workspace = new WorkspacePage(page);
    await expect(workspace.breadcrumbs).toBeVisible();

    await expect(workspace.rowByName("readme.txt").first()).toBeVisible();
    await workspace.selectFile("readme.txt");

    // `e2e seed fixture` is a leading substring of the payload, avoiding an em-dash
    // mojibake the HAR recorder captured.
    await expect(page.locator(".cm-content")).toContainText("e2e seed fixture");
  });
});
