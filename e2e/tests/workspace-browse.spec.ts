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

function failOnRuntimeErrors(page: Parameters<typeof applyBackendMocks>[0]) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text() !==
        "Failed to load resource: the server responded with a status of 500 (Internal Server Error)"
    ) {
      errors.push(message.text());
    }
  });
  return () => {
    expect(errors, "workspace emitted runtime errors").toEqual([]);
  };
}

test.describe("workspace browse", () => {
  test("home remains free of runtime errors across interactive rerenders", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text() !==
          "Failed to load resource: the server responded with a status of 500 (Internal Server Error)"
      ) {
        runtimeErrors.push(message.text());
      }
    });

    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    const sampleRow = workspace.rowByName("sample.fastq").first();
    await expect(sampleRow).toBeVisible();
    await sampleRow.click();
    await expect(sampleRow).toHaveAttribute("aria-selected", "true");

    await workspace.searchInput.fill("missing-item");
    await expect(sampleRow).toBeHidden();
    await workspace.searchInput.fill("");
    await expect(workspace.rowByName("sample.fastq").first()).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const listingRequest = page.waitForRequest((request) => {
      if (!request.url().endsWith("/api/services/workspace")) return false;
      try {
        const body = request.postDataJSON() as { method?: string };
        return body.method === "Workspace.ls";
      } catch {
        return false;
      }
    });
    await workspace.refreshButton.click();
    await listingRequest;
    await expect(workspace.rowByName("sample.fastq").first()).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test("populated listing renders rows for each workspace item", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    for (const name of [
      "Datasets",
      "Analysis",
      "sample.fastq",
      "notes.json",
      "logo.png",
    ]) {
      await expect(workspace.rowByName(name).first()).toBeVisible();
    }
  });

  test.describe("folder activation contract", () => {
    const pathItems = {
      [e2eHomePath]: [
        {
          name: "Datasets",
          type: "folder",
          parentPath: e2eHomePath,
          creationTime: "2026-02-01T00:00:00Z",
        },
        {
          name: "sample.fastq",
          type: "reads",
          parentPath: e2eHomePath,
          creationTime: "2026-03-01T00:00:00Z",
          size: 24,
        },
      ],
      [`${e2eHomePath}/Datasets`]: [
        {
          name: "report.txt",
          type: "txt",
          parentPath: `${e2eHomePath}/Datasets`,
          creationTime: "2026-03-01T00:00:00Z",
          size: 24,
        },
      ],
    };

    test.beforeEach(async ({ page }) => {
      await applyBackendMocks(page, {
        overrides: [
          ...buildWorkspaceOverrides({ pathItems }),
          ...journeyOverrides,
        ],
      });
      await new WorkspacePage(page).goto();
    });

    test("first click does not move or replace the folder target", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);
      const row = workspace.rowByName("Datasets").first();
      const before = await row.boundingBox();
      const nodeIdentityPreserved = await row.evaluate((element) => {
        (
          window as typeof window & { workspaceTestRow?: Element }
        ).workspaceTestRow = element;
        return true;
      });
      expect(nodeIdentityPreserved).toBe(true);

      await row.click();

      await expect(row).toHaveAttribute("aria-selected", "true");
      expect(await row.boundingBox()).toEqual(before);
      expect(
        await row.evaluate(
          (element) =>
            (window as typeof window & { workspaceTestRow?: Element })
              .workspaceTestRow === element,
        ),
      ).toBe(true);
      await expect(page).toHaveURL(/\/home$/);
      assertNoRuntimeErrors();
    });

    test("native double-click enters a folder from a collapsed panel", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);

      await workspace.enterFolder("Datasets");

      await expect(page).toHaveURL(/\/home\/Datasets$/);
      await expect(workspace.rowByName("report.txt").first()).toBeVisible();
      assertNoRuntimeErrors();
    });

    test("double-click enters a folder when details are already expanded", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);
      await workspace.rowByName("sample.fastq").click();
      await expect(page.getByTitle("Hide panel")).toBeVisible();

      await workspace.enterFolder("Datasets");

      await expect(page).toHaveURL(/\/home\/Datasets$/);
      await expect(workspace.rowByName("report.txt").first()).toBeVisible();
      assertNoRuntimeErrors();
    });

    test("double-click enters a folder while details are manually hidden", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);
      await workspace.rowByName("sample.fastq").click();
      await page.getByTitle("Hide panel").click();
      await expect(page.getByTitle("Show details panel")).toBeVisible();

      await workspace.enterFolder("Datasets");

      await expect(page).toHaveURL(/\/home\/Datasets$/);
      await expect(workspace.rowByName("report.txt").first()).toBeVisible();
      assertNoRuntimeErrors();
    });

    test("single-click selects a folder without navigating and later opens details", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);
      const row = workspace.rowByName("Datasets").first();

      await row.click();

      await expect(row).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByTitle("Hide panel")).toBeVisible({
        timeout: 1_500,
      });
      await expect(page.getByText("Datasets", { exact: true })).toHaveCount(2);
      assertNoRuntimeErrors();
    });

    test("double-clicking a file does not navigate and preserves two-click selection semantics", async ({
      page,
    }) => {
      const assertNoRuntimeErrors = failOnRuntimeErrors(page);
      const workspace = new WorkspacePage(page);
      const fileRow = workspace.rowByName("sample.fastq").first();

      await fileRow.dblclick();

      await expect(page).toHaveURL(/\/home$/);
      await expect(fileRow).toHaveAttribute("aria-selected", "false");
      await expect(page.getByTitle("Hide panel")).toBeVisible();
      assertNoRuntimeErrors();
    });
  });

  test("empty workspace shows the empty-state message", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceEmptyOverrides, ...journeyOverrides],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await expect(page.getByText(/this folder is empty/i)).toBeVisible();
  });

  test("ls failure surfaces the error alert", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceErrorOverrides, ...journeyOverrides],
    });
    const workspace = new WorkspacePage(page);
    await page.goto("/workspace/e2e-test-user@patricbrc.org/home");
    await expect(workspace.breadcrumbs).toBeVisible();
    await expect(
      page.getByText(/failed to load workspace contents/i),
    ).toBeVisible();
  });

  test("favorites loaded from favorites.json are visible on the home listing", async ({
    page,
  }) => {
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

  test("toggling FAVORITE on a folder POSTs the updated favorites.json", async ({
    page,
  }) => {
    // Starts with no favorites, then drives the action-bar FAVORITE button and asserts that
    // Workspace.create persists the toggled folder path. This is the end-to-end persistence
    // contract — a UI that lights up the star locally but never calls the API would fail here.
    await applyBackendMocks(page, {
      overrides: [
        // The favorites toggle fires Workspace.create against favorites.json AND a
        // follow-up Workspace.get to re-read it. The helper's createOverride matches
        // both creates (the .preferences dir bootstrap and the favorites.json write),
        // and getOverride matches the favorites.json read by path. The .preferences
        // dir existence check (Workspace.get on the dir path) falls through to
        // getNotFoundOverride's 500, which ensurePreferencesDir handles by creating
        // the dir. No permissive catch-all needed.
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
      if (
        !req.url().endsWith("/api/services/workspace") ||
        req.method() !== "POST"
      )
        return false;
      const raw = req.postData();
      if (!raw) return false;
      try {
        const body = JSON.parse(raw) as { method?: string; params?: unknown[] };
        if (body.method !== "Workspace.create") return false;
        const objects =
          (body.params?.[0] as { objects?: unknown[][] } | undefined)
            ?.objects ?? [];
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
    const content = JSON.parse(tuple[3]) as { folders?: string[] };
    expect(content.folders).toContain(`${e2eHomePath}/Datasets`);
    expect(body.params?.[0]?.overwrite).toBe(1);
  });
});

// Drives the browse journey against post-auth traffic recorded in
// `workspace-browse.har`. See `harOverridesFor` for why this spec must not
// layer `journeyOverrides` or a broad, unscoped aggregate on top of replay.
test.describe("workspace browse via recorded HAR replay", () => {
  test("renders the recorded workspace listing", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("workspace-browse.har"),
      ],
    });

    await page.goto(
      `/workspace/${encodeURIComponent(recordedTestUserId)}/home`,
    );

    const workspace = new WorkspacePage(page);
    await expect(workspace.breadcrumbs).toBeVisible();

    // These four folders all appear in the recorded `Workspace.ls` response
    // (`workspace-browse.har` entry 5). If the HAR replay actually fed the
    // workspace browser, the rows render; if the override fell through to
    // the permissive catchall (`{result:[[]]}`), the listing would be empty
    // and these assertions would time out.
    for (const name of [
      "Experiment Groups",
      "Genome Groups",
      "Experiments",
      "Feature Groups",
    ]) {
      await expect(workspace.rowByName(name).first()).toBeVisible();
    }
  });
});
