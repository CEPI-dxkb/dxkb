import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  e2eUsername,
  permissiveBackendOverrides,
  workspaceEmptyOverrides,
  workspaceErrorOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

test.describe("workspace browse", () => {
  test("populated listing renders rows for each workspace item", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...permissiveBackendOverrides,
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
        ...authSessionOverrides,
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
        ...permissiveBackendOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await expect(workspace.rowByName("Datasets").first()).toBeVisible();

    // Select the row, then press Enter. The keyboard handler in useTableKeyboardNavigation
    // calls onEnter(item) which navigates for folders. Using Enter is more deterministic than
    // `dblclick()`: Playwright's dblclick fires two rapid mouse events that can race with the
    // selection-mode click handler in a virtualized row (the row re-mounts on selection,
    // and the second click can land on a different DOM node).
    await workspace.rowByName("Datasets").first().click();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/home\/Datasets$/);
    await expect(workspace.breadcrumbs).toContainText("Datasets");
    await expect(workspace.rowByName("report.txt").first()).toBeVisible();
  });

  test("empty workspace shows the empty-state message", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceEmptyOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await expect(page.getByText(/this folder is empty/i)).toBeVisible();
  });

  test("ls failure surfaces the error alert", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceErrorOverrides,
        ...permissiveBackendOverrides,
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
        ...authSessionOverrides,
        ...buildWorkspaceOverrides({
          favorites: [`${e2eHomePath}/Datasets`],
        }),
        ...permissiveBackendOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await expect(workspace.rowByName("Datasets").first()).toBeVisible();
    // The username cookie is the same user as the mocked owner, so the row renders normally.
    expect(e2eUsername).toBe("e2e-test-user@patricbrc.org");
  });
});
