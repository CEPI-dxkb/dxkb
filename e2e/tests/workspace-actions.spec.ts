import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  buildWorkspaceOverrides,
  e2eHomePath,
  e2eUsername,
  journeyOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

test.describe("workspace actions", () => {
  test("creating a folder POSTs Workspace.create with type=Directory and the new row appears", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // reflectUploads covers folder creates: Workspace.create with type "Directory" appends
        // the new folder to pathItems so the post-create Workspace.ls refresh surfaces the row.
        ...buildWorkspaceOverrides({ reflectUploads: true }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Open the New Folder dialog from the toolbar.
    await workspace.openNewFolder();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill the folder name before registering the request watcher so the field is ready.
    await dialog.getByLabel(/folder name/i).fill("e2e-new-folder");

    // Register the request predicate BEFORE clicking so we don't race against the POST.
    // http-workspace-repository sends type "Directory" (capital D) for createFolder calls.
    // The confirm button renders "Create Folder" (not "Create") per create-folder-dialog.tsx.
    const createRequestPromise = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") {
        return false;
      }
      try {
        const body = JSON.parse(req.postData() ?? "{}") as {
          method?: string;
          params?: unknown[];
        };
        if (body.method !== "Workspace.create") return false;
        const objects = (body.params?.[0] as { objects?: unknown[][] } | undefined)
          ?.objects ?? [];
        const first = objects[0];
        return Array.isArray(first) && String(first[1]) === "Directory";
      } catch {
        return false;
      }
    });

    await dialog.getByRole("button", { name: /^create folder$/i }).click();
    const req = await createRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{ objects?: unknown[][] }];
    };
    const tuple = body.params?.[0]?.objects?.[0] as
      | [string, string]
      | undefined;
    expect(tuple?.[0]).toBe(`${e2eHomePath}/e2e-new-folder`);
    expect(tuple?.[1]).toBe("Directory");

    // After the create resolves, Workspace.ls refreshes and the new row appears.
    await expect(workspace.rowByName("e2e-new-folder").first()).toBeVisible();
  });

  test("deleting a file confirms via dialog and POSTs Workspace.delete", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Single owned file in home. Omitting `userPermission` defaults to "o" via
        // workspaceTuple, which makes the DELETE action (requireWrite) visible.
        // Workspace.delete itself doesn't have an explicit override here — this test
        // asserts on the request shape, so the catch-all answers the unmocked POST.
        ...buildWorkspaceOverrides({
          pathItems: {
            [e2eHomePath]: [
              {
                name: "to-delete.txt",
                type: "txt",
                parentPath: e2eHomePath,
                creationTime: "2026-04-01T00:00:00Z",
                size: 12,
              },
            ],
          },
          permissiveCatchall: true,
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Select the row so the DELETE action becomes valid.
    await workspace.rowByName("to-delete.txt").first().click();

    // The action-bar DELETE button is the only matching control on the page at
    // this point — the dialog opens after the click. Use the same case-insensitive
    // regex the dialog button uses below for selector-style consistency.
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Delete uses an AlertDialog (role="alertdialog", not "dialog").
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/to-delete\.txt/);

    const deleteRequestPromise = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") {
        return false;
      }
      try {
        const body = JSON.parse(req.postData() ?? "{}") as { method?: string };
        return body.method === "Workspace.delete";
      } catch {
        return false;
      }
    });

    // The footer action button text is "Delete" (capital D, no spinner since not yet deleting).
    await dialog.getByRole("button", { name: /^delete$/i }).click();
    const req = await deleteRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{ objects?: string[]; force?: boolean; deleteDirectories?: boolean }];
    };
    expect(body.params?.[0]?.objects).toContain(`${e2eHomePath}/to-delete.txt`);
    // Both flags default to true in http-workspace-repository.delete and the UI
    // does not expose them — pin the wire defaults so a behaviour change is caught.
    expect(body.params?.[0]?.force).toBe(true);
    expect(body.params?.[0]?.deleteDirectories).toBe(true);
  });

  test("copying a folder to the workspace root POSTs Workspace.copy with move: false", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Single owned folder in home. COPY action is "*"-typed (no requireWrite on the source),
        // so the default "o" permission from workspaceTuple is sufficient.
        // pathItems also includes a root listing ("/") so ensureDestinationWriteAccess —
        // which calls Workspace.ls at "/" to verify write access on the workspace root
        // destination before firing Workspace.copy — can find the workspace root folder.
        ...buildWorkspaceOverrides({
          pathItems: {
            // Root listing: Workspace.ls at "/" returns the workspace root folder entry.
            // ensureDestinationWriteAccess calls listFolder("/") when the destination
            // is the workspace root (e.g. /e2e-test-user@patricbrc.org).
            "/": [
              {
                name: e2eUsername,
                type: "folder",
                parentPath: "/",
                userPermission: "o",
              },
            ],
            [e2eHomePath]: [
              {
                name: "Datasets",
                type: "folder",
                parentPath: e2eHomePath,
                creationTime: "2026-02-01T00:00:00Z",
              },
            ],
          },
          // Workspace.copy itself isn't pinned in the helper; the catch-all answers it
          // since this test asserts on the request shape, not the post-copy listing.
          permissiveCatchall: true,
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Select the folder row so the COPY action becomes visible.
    await workspace.rowByName("Datasets").first().click();

    // The action-bar COPY button (label "COPY") is the only matching control before
    // the dialog opens; case-insensitive regex matches the all-caps label.
    await page.getByRole("button", { name: /^copy$/i }).click();

    // Copy uses a regular Dialog (role="dialog", not alertdialog).
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Register the request watcher BEFORE clicking confirm so we don't race.
    const copyRequestPromise = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") {
        return false;
      }
      try {
        const body = JSON.parse(req.postData() ?? "{}") as { method?: string };
        return body.method === "Workspace.copy";
      } catch {
        return false;
      }
    });

    // The dialog's default destinationPath is the workspace root. For a folder source,
    // rootWithIncompatibleTypes is false, so the Copy button is enabled immediately —
    // no mini-browser navigation required.
    await dialog.getByRole("button", { name: /^copy$/i }).click();
    const req = await copyRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{
        objects?: [string, string][];
        recursive?: boolean;
        move?: boolean;
      }];
    };
    const pairs = body.params?.[0]?.objects ?? [];
    expect(pairs.length).toBe(1);
    // Source path is the full path of the selected folder.
    expect(pairs[0]?.[0]).toBe(`${e2eHomePath}/Datasets`);
    // Destination contains the source folder name (default filename preserved).
    expect(pairs[0]?.[1]).toMatch(/Datasets/);
    // move: false distinguishes copy from move; recursive: true is the default.
    expect(body.params?.[0]?.move).toBe(false);
    expect(body.params?.[0]?.recursive).toBe(true);
  });

  test("moving a folder to the workspace root POSTs Workspace.copy with move: true", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Source folder + root listing for ensureDestinationWriteAccess. Default "o"
        // userPermission satisfies the MOVE action's requireWrite gate.
        ...buildWorkspaceOverrides({
          pathItems: {
            // Root listing: Workspace.ls at "/" returns the workspace root folder entry.
            // ensureDestinationWriteAccess calls listFolder("/") when the destination
            // is the workspace root (e.g. /e2e-test-user@patricbrc.org).
            "/": [
              {
                name: e2eUsername,
                type: "folder",
                parentPath: "/",
                userPermission: "o",
              },
            ],
            [e2eHomePath]: [
              {
                name: "Datasets",
                type: "folder",
                parentPath: e2eHomePath,
                creationTime: "2026-02-01T00:00:00Z",
              },
            ],
          },
          // Workspace.copy (with move: true) isn't pinned by the helper; the catch-all
          // responds since this test asserts on request shape, not response handling.
          permissiveCatchall: true,
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await workspace.rowByName("Datasets").first().click();

    // Action-bar MOVE button (label "MOVE"). Case-insensitive regex matches.
    await page.getByRole("button", { name: /^move$/i }).click();

    // Move uses the same Dialog as copy (role="dialog").
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const moveRequestPromise = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") {
        return false;
      }
      try {
        const body = JSON.parse(req.postData() ?? "{}") as {
          method?: string;
          params?: unknown[];
        };
        if (body.method !== "Workspace.copy") return false;
        const moveFlag = (body.params?.[0] as { move?: boolean } | undefined)?.move;
        return moveFlag === true;
      } catch {
        return false;
      }
    });

    // Default destination is the workspace root; folder sources are valid there.
    // The dialog button label is "Move" in move mode (vs "Copy" in copy mode).
    await dialog.getByRole("button", { name: /^move$/i }).click();
    const req = await moveRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{
        objects?: [string, string][];
        recursive?: boolean;
        move?: boolean;
      }];
    };
    const pairs = body.params?.[0]?.objects ?? [];
    expect(pairs.length).toBe(1);
    // Source path is the full path of the selected folder.
    expect(pairs[0]?.[0]).toBe(`${e2eHomePath}/Datasets`);
    // Destination contains the source folder name (default filename preserved).
    expect(pairs[0]?.[1]).toMatch(/Datasets/);
    // move: true distinguishes move from copy; recursive: true is the default.
    expect(body.params?.[0]?.move).toBe(true);
    expect(body.params?.[0]?.recursive).toBe(true);
  });

  test("editing a file's type POSTs Workspace.update_metadata with the new type", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Single owned txt file. Default "o" userPermission satisfies requireWrite for editType.
        ...buildWorkspaceOverrides({
          pathItems: {
            [e2eHomePath]: [
              {
                name: "sample.dat",
                type: "txt",
                parentPath: e2eHomePath,
                creationTime: "2026-04-01T00:00:00Z",
                size: 12,
              },
            ],
          },
          // Workspace.update_metadata isn't pinned by the helper; the catch-all
          // responds since this test asserts on request shape, not response handling.
          permissiveCatchall: true,
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Select the row so the EDIT TYPE action becomes visible.
    await workspace.rowByName("sample.dat").first().click();

    // Action-bar EDIT TYPE button (label "EDIT TYPE" with a space).
    await page.getByRole("button", { name: /^edit type$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/change object type/i);

    // Open the type Select (base-ui renders the trigger as role="combobox") and choose
    // "contigs" from the popover. Options render outside the dialog node in a portal,
    // so use page.getByRole (not dialog.getByRole) to find them.
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: /^contigs$/i }).click();

    // Register the request watcher BEFORE clicking Save so we don't race the POST.
    const updateRequestPromise = page.waitForRequest((req) => {
      if (!req.url().endsWith("/api/services/workspace") || req.method() !== "POST") {
        return false;
      }
      try {
        const body = JSON.parse(req.postData() ?? "{}") as { method?: string };
        return body.method === "Workspace.update_metadata";
      } catch {
        return false;
      }
    });

    await dialog.getByRole("button", { name: /^save$/i }).click();
    const req = await updateRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{ objects?: [string, Record<string, unknown>, string][] }];
    };
    // Wire shape: objects is an array of [path, emptyMetadata, newType] tuples.
    const tuple = body.params?.[0]?.objects?.[0];
    expect(tuple?.[0]).toBe(`${e2eHomePath}/sample.dat`);
    expect(tuple?.[1]).toEqual({});
    expect(tuple?.[2]).toBe("contigs");
  });
});
