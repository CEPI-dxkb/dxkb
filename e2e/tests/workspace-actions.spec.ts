import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  buildWorkspaceOverrides,
  e2eHomePath,
  e2eUsername,
  journeyOverrides,
  workspaceRpcOverride,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

test.describe("workspace actions", () => {
  test("creating a folder POSTs Workspace.create with type=Directory and the new row appears", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // reflectFolderCreates: Workspace.create with type "Directory" appends the new folder
        // tuple to pathItems so the post-create Workspace.ls refresh surfaces the row.
        // Distinct from reflectUploads (which covers file uploads) so this spec doesn't also
        // reflect any incidental file-upload Workspace.create traffic.
        ...buildWorkspaceOverrides({ reflectFolderCreates: true }),
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
        // The test asserts on the Workspace.delete request shape, so we pin only
        // that method explicitly — leaving the catch-all off keeps strict-mode
        // tripping on any new RPC the action introduces.
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
          extraRpc: [workspaceRpcOverride("Workspace.delete", { result: [[]] })],
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

  test("copying a file: pick a non-default destination via the mini-browser and POST Workspace.copy with move: false", async ({
    page,
  }) => {
    // The CopyToDialog mini-browser at root mode renders items from `useUserWorkspaces`,
    // which derives the root listing path by stripping the realm from the workspaceRoot
    // and reapplying `@bvbrc` (see `useUserWorkspaces` in
    // src/hooks/services/workspace/use-shared-with-user.ts). With workspaceRoot
    // `/e2e-test-user@patricbrc.org`, the hook ends up requesting `/e2e-test-user@bvbrc`
    // — so the destination tree we render here lives at that path, and any picked
    // destination paths use the same `@bvbrc` segment.
    const userBvbrcRoot = `/${e2eUsername.split("@")[0]}@bvbrc`;
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides({
          pathItems: {
            // Workspace.ls at "/" — used by ensureDestinationWriteAccess and by the
            // mini-browser's `useSharedWithUser` scan for shared folders.
            "/": [
              {
                name: e2eUsername,
                type: "folder",
                parentPath: "/",
                userPermission: "o",
              },
            ],
            // Workspace root listing the mini-browser actually queries (via
            // useUserWorkspaces). Stage "Reports" + "Archive" so we have at least
            // one obviously-pickable folder row that's distinct from the default
            // root destination.
            [userBvbrcRoot]: [
              {
                name: "Reports",
                type: "folder",
                parentPath: userBvbrcRoot,
                userPermission: "o",
              },
              {
                name: "Archive",
                type: "folder",
                parentPath: userBvbrcRoot,
                userPermission: "o",
              },
            ],
            // Source listing in /home — a single source file we'll copy.
            [e2eHomePath]: [
              {
                name: "report.txt",
                type: "txt",
                parentPath: e2eHomePath,
                creationTime: "2026-04-01T00:00:00Z",
                size: 12,
              },
            ],
          },
          // Pin Workspace.copy explicitly. The test asserts on its request shape, and
          // the explicit override keeps strict-mode active for any unrelated RPC.
          extraRpc: [workspaceRpcOverride("Workspace.copy", { result: [[]] })],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    // Source is a file. Click the row to select it as the COPY action's source.
    await workspace.rowByName("report.txt").first().click();
    await page.getByRole("button", { name: /^copy$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The dialog's default destination is the workspace root. For a file source,
    // rootWithIncompatibleTypes blocks the Copy button until the user picks a folder
    // destination. Single-click on a folder row in the mini-browser sets that folder
    // as the destinationPath (vs. dblclick which navigates into the folder).
    const confirmButton = dialog.getByRole("button", { name: /^copy$/i });
    await expect(confirmButton).toBeDisabled();

    // The mini-browser table row's accessible name combines all visible cell texts —
    // match against just the leading folder-name token so date/owner cell drift doesn't
    // brittle the selector. `data-row-key` would be cleaner but is internal markup.
    const reportsRow = dialog.getByRole("row", { name: /^Reports\s/ }).first();
    await reportsRow.click();
    await expect(confirmButton).toBeEnabled();

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

    await confirmButton.click();
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
    // Source path is the full path of the selected file.
    expect(pairs[0]?.[0]).toBe(`${e2eHomePath}/report.txt`);
    // Destination uses the picked "Reports" folder under the @bvbrc root the mini-browser
    // queries — distinct from the @patricbrc.org workspace-root default — with the
    // original filename preserved.
    expect(pairs[0]?.[1]).toBe(`${userBvbrcRoot}/Reports/report.txt`);
    // move: false distinguishes copy from move; recursive: true is the default.
    expect(body.params?.[0]?.move).toBe(false);
    expect(body.params?.[0]?.recursive).toBe(true);
  });

  test("moving a file: pick a non-default destination via the mini-browser and POST Workspace.copy with move: true", async ({
    page,
  }) => {
    // See the copy test above for why the destination listing lives at /<user>@bvbrc.
    const userBvbrcRoot = `/${e2eUsername.split("@")[0]}@bvbrc`;
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides({
          pathItems: {
            "/": [
              {
                name: e2eUsername,
                type: "folder",
                parentPath: "/",
                userPermission: "o",
              },
            ],
            [userBvbrcRoot]: [
              {
                name: "Reports",
                type: "folder",
                parentPath: userBvbrcRoot,
                userPermission: "o",
              },
              {
                name: "Archive",
                type: "folder",
                parentPath: userBvbrcRoot,
                userPermission: "o",
              },
            ],
            [e2eHomePath]: [
              {
                name: "report.txt",
                type: "txt",
                parentPath: e2eHomePath,
                creationTime: "2026-04-01T00:00:00Z",
                size: 12,
              },
            ],
          },
          // Move uses Workspace.copy with move: true. Pin only that method so any
          // other unexpected RPC trips strict-mode.
          extraRpc: [workspaceRpcOverride("Workspace.copy", { result: [[]] })],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await workspace.rowByName("report.txt").first().click();
    await page.getByRole("button", { name: /^move$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Default destination (workspace root) is incompatible for a file source — Move stays
    // disabled until the user picks a folder row from the mini-browser.
    const confirmButton = dialog.getByRole("button", { name: /^move$/i });
    await expect(confirmButton).toBeDisabled();

    // The mini-browser table row's accessible name combines all visible cell texts —
    // match against just the leading folder-name token so date/owner cell drift doesn't
    // brittle the selector. `data-row-key` would be cleaner but is internal markup.
    const reportsRow = dialog.getByRole("row", { name: /^Reports\s/ }).first();
    await reportsRow.click();
    await expect(confirmButton).toBeEnabled();

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

    await confirmButton.click();
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
    expect(pairs[0]?.[0]).toBe(`${e2eHomePath}/report.txt`);
    // Destination uses the picked "Reports" folder under the @bvbrc root, not the
    // @patricbrc.org workspace root default.
    expect(pairs[0]?.[1]).toBe(`${userBvbrcRoot}/Reports/report.txt`);
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
          // Pin Workspace.update_metadata explicitly so the test asserts on its
          // request shape against a real override, not a permissive catch-all.
          extraRpc: [workspaceRpcOverride("Workspace.update_metadata", { result: [[]] })],
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
