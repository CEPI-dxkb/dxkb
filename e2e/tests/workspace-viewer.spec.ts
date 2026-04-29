import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  permissiveBackendOverrides,
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

// Drives the file-viewer journey against post-auth traffic recorded in
// `workspace-viewer.har`. The HAR captures the workspace listing for the
// seeded folder, the viewer's `/api/workspace/view/<path>` GET, and the
// JSON-RPC envelope around it. Three sequential `Workspace.get` entries
// (favorites x2, then the e2e-fixtures folder lookup) replay in HAR order
// via `callIndex`. See `harOverridesFor` for the canary rationale (no
// `permissiveBackendOverrides` here).
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

    // The recorded `Workspace.ls` for `home/e2e-fixtures` returns a single
    // `readme.txt` row.
    await expect(workspace.rowByName("readme.txt").first()).toBeVisible();
    await workspace.selectFile("readme.txt");

    // CodeMirror renders the recorded `/api/workspace/view/.../readme.txt`
    // body into `.cm-content`. `e2e seed fixture` is the leading substring
    // of the recorded payload — sidesteps the em-dash mojibake the HAR
    // recorder captured downstream of it.
    await expect(page.locator(".cm-content")).toContainText("e2e seed fixture");
  });
});
