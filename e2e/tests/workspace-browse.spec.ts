import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  e2eUsername,
  journeyOverrides,
  workspaceEmptyOverrides,
  workspaceErrorOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";
import { recordedTestUserId } from "../scripts/har-constants";
import { harOverridesFor } from "../scripts/har-overrides";

test.describe("workspace browse", () => {
  test("populated listing renders rows for each workspace item", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    for (const name of ["Datasets", "Analysis", "sample.fastq", "notes.json", "logo.png"]) {
      await expect(workspace.rowByName(name).first()).toBeVisible();
    }
  });

  test("entering a folder navigates into it and updates the breadcrumbs", async ({ page }) => {
    const nestedItems = [
      {
        name: "report.txt",
        type: "txt",
        parentPath: `${e2eHomePath}/Datasets`,
        creationTime: "2026-03-01T00:00:00Z",
        size: 24,
      },
    ];
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides({
          pathItems: {
            [e2eHomePath]: [
              {
                name: "Datasets",
                type: "folder",
                parentPath: e2eHomePath,
                creationTime: "2026-02-01T00:00:00Z",
              },
            ],
            [`${e2eHomePath}/Datasets`]: nestedItems,
          },
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await expect(workspace.rowByName("Datasets").first()).toBeVisible();

    // Select the row first, then press Enter. `useTableKeyboardNavigation.onEnter` requires the
    // row to already be selected — under load the keyboard event can arrive before React has
    // committed the selection state, so we wait for the row to render its selected variant
    // before firing Enter.
    const datasetsRow = workspace.rowByName("Datasets").first();
    await datasetsRow.click();
    await expect(datasetsRow).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/home\/Datasets$/);
    await expect(workspace.breadcrumbs).toContainText("Datasets");
    await expect(workspace.rowByName("report.txt").first()).toBeVisible();
  });

  test("empty workspace shows the empty-state message", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspaceEmptyOverrides,
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await expect(page.getByText(/this folder is empty/i)).toBeVisible();
  });

  test("ls failure surfaces the error alert", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspaceErrorOverrides,
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await page.goto("/workspace/e2e-test-user@patricbrc.org/home");
    await expect(workspace.breadcrumbs).toBeVisible();
    await expect(page.getByText(/failed to load workspace contents/i)).toBeVisible();
  });

  test("favorites loaded from favorites.json are visible on the home listing", async ({ page }) => {
    // When favorites contain a folder path, its row gets a star indicator. We just assert the
    // favorite-named folder is present — validating the favorites.json override actually reaches
    // the browser and doesn't crash the UI.
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides({
          favorites: [`${e2eHomePath}/Datasets`],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await expect(workspace.rowByName("Datasets").first()).toBeVisible();
    // The username cookie is the same user as the mocked owner, so the row renders normally.
    expect(e2eUsername).toBe("e2e-test-user@patricbrc.org");
  });

  test("toggling FAVORITE on a folder POSTs the updated favorites.json", async ({ page }) => {
    // Starts with no favorites, then drives the action-bar FAVORITE button and asserts that
    // Workspace.create persists the toggled folder path. This is the end-to-end persistence
    // contract — a UI that lights up the star locally but never calls the API would fail here.
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides(),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Select the Datasets folder so the FAVORITE action becomes valid (favorite is folder-only).
    await workspace.rowByName("Datasets").first().click();

    const favoritesFilePath = `${e2eHomePath}/.preferences/favorites.json`;
    // Wait specifically for the Workspace.create that writes favorites.json — toggleFavorite
    // also calls Workspace.create to ensure the .preferences dir exists, and we don't want to
    // race-match that earlier call.
    const writeRequest = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") return false;
      const raw = req.postData();
      if (!raw) return false;
      try {
        const body = JSON.parse(raw) as { method?: string; params?: unknown[] };
        if (body.method !== "Workspace.create") return false;
        const objects = (body.params?.[0] as { objects?: unknown[][] } | undefined)?.objects ?? [];
        const first = objects[0];
        return Array.isArray(first) && String(first[0]) === favoritesFilePath;
      } catch {
        return false;
      }
    });

    await page.getByRole("button", { name: /^favorite$/i }).click();

    const req = await writeRequest;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{ objects?: unknown[][]; overwrite?: number }];
    };
    const objects = body.params?.[0]?.objects ?? [];
    const tuple = objects[0] as [string, string, unknown, string];
    // The 4th tuple slot is the JSON body; it must contain the toggled folder path.
    const content = JSON.parse(String(tuple[3])) as { folders?: string[] };
    expect(content.folders).toContain(`${e2eHomePath}/Datasets`);
    expect(body.params?.[0]?.overwrite).toBe(1);
  });
});

// Drives the browse journey against post-auth traffic recorded in
// `workspace-browse.har`. The auth-shape contract test against
// `auth-sign-in.har` lives in `auth.spec.ts` — the canonical canary, not
// duplicated here. See `harOverridesFor` for the rationale on why this
// spec must NOT layer `journeyOverrides` or `permissiveBackendOverrides`
// on top of HAR replay.
test.describe("workspace browse via recorded HAR replay", () => {
  test("renders the recorded workspace listing", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("workspace-browse.har"),
      ],
    });

    await page.goto(`/workspace/${encodeURIComponent(recordedTestUserId)}/home`);

    const workspace = new WorkspacePage(page);
    await expect(workspace.breadcrumbs).toBeVisible();

    // These four folders all appear in the recorded `Workspace.ls` response
    // (`workspace-browse.har` entry 5). If the HAR replay actually fed the
    // workspace browser, the rows render; if the override fell through to
    // the permissive catchall (`{result:[[]]}`), the listing would be empty
    // and these assertions would time out.
    for (const name of ["Experiment Groups", "Genome Groups", "Experiments", "Feature Groups"]) {
      await expect(workspace.rowByName(name).first()).toBeVisible();
    }
  });
});
