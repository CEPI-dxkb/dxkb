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
        // reflectFolderCreates appends created Directory tuples to pathItems so the
        // refreshed Workspace.ls shows the row.
        ...buildWorkspaceOverrides({ reflectFolderCreates: true }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await workspace.openNewFolder();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/folder name/i).fill("e2e-new-folder");

    // Register the request predicate before clicking to avoid racing the POST.
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

    await expect(workspace.rowByName("e2e-new-folder").first()).toBeVisible();
  });

  test("deleting a file confirms via dialog and POSTs Workspace.delete", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Pin only Workspace.delete so strict mode trips on any new RPC the action
        // introduces.
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

    await workspace.rowByName("to-delete.txt").first().click();

    await page.getByRole("button", { name: /^delete$/i }).click();

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

    await dialog.getByRole("button", { name: /^delete$/i }).click();
    const req = await deleteRequestPromise;
    const body = JSON.parse(req.postData() ?? "{}") as {
      params?: [{ objects?: string[]; force?: boolean; deleteDirectories?: boolean }];
    };
    expect(body.params?.[0]?.objects).toContain(`${e2eHomePath}/to-delete.txt`);
    // Both flags default to true in the repository and the UI does not expose them; pin
    // the wire defaults.
    expect(body.params?.[0]?.force).toBe(true);
    expect(body.params?.[0]?.deleteDirectories).toBe(true);
  });

  test("copying a file: pick a non-default destination via the mini-browser and POST Workspace.copy with move: false", async ({
    page,
  }) => {
    // The realm-qualified root (`@patricbrc.org`) is kept, not replaced with `@bvbrc`,
    // which would list another user's workspace.
    const userRoot = `/${e2eUsername}`;
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
            [userRoot]: [
              {
                name: "Reports",
                type: "folder",
                parentPath: userRoot,
                userPermission: "o",
              },
              {
                name: "Archive",
                type: "folder",
                parentPath: userRoot,
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
          // Pin Workspace.copy so strict mode stays active for unrelated RPCs.
          extraRpc: [workspaceRpcOverride("Workspace.copy", { result: [[]] })],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await workspace.rowByName("report.txt").first().click();
    await page.getByRole("button", { name: /^copy$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The default destination (root) is incompatible with a file source
    // (rootWithIncompatibleTypes); a single click on a folder row picks it, a
    // double-click navigates.
    const confirmButton = dialog.getByRole("button", { name: /^copy$/i });
    await expect(confirmButton).toBeDisabled();

    // The row's accessible name combines all cell texts; match the leading folder name
    // so date/owner drift does not break it.
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
    expect(pairs[0]?.[0]).toBe(`${e2eHomePath}/report.txt`);
    expect(pairs[0]?.[1]).toBe(`${userRoot}/Reports/report.txt`);
    expect(body.params?.[0]?.move).toBe(false);
    expect(body.params?.[0]?.recursive).toBe(true);
  });

  test("moving a file: pick a non-default destination via the mini-browser and POST Workspace.copy with move: true", async ({
    page,
  }) => {
    const userRoot = `/${e2eUsername}`;
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
            [userRoot]: [
              {
                name: "Reports",
                type: "folder",
                parentPath: userRoot,
                userPermission: "o",
              },
              {
                name: "Archive",
                type: "folder",
                parentPath: userRoot,
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

    const confirmButton = dialog.getByRole("button", { name: /^move$/i });
    await expect(confirmButton).toBeDisabled();

    // The row's accessible name combines all cell texts; match the leading folder name
    // so date/owner drift does not break it.
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
    expect(pairs[0]?.[1]).toBe(`${userRoot}/Reports/report.txt`);
    expect(body.params?.[0]?.move).toBe(true);
    expect(body.params?.[0]?.recursive).toBe(true);
  });

  test("editing a file's type POSTs Workspace.update_metadata with the new type", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
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
          extraRpc: [workspaceRpcOverride("Workspace.update_metadata", { result: [[]] })],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();

    await workspace.rowByName("sample.dat").first().click();

    await page.getByRole("button", { name: /^edit type$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/change object type/i);

    // Options render in a portal outside the dialog, so use page.getByRole, not
    // dialog.getByRole.
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: /^contigs$/i }).click();
    // In WebKit the portal overlay can stay in the DOM after selection and block Save's
    // click; wait for the option to detach.
    await expect(page.getByRole("option", { name: /^contigs$/i })).not.toBeAttached();

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
    const tuple = body.params?.[0]?.objects?.[0];
    expect(tuple?.[0]).toBe(`${e2eHomePath}/sample.dat`);
    expect(tuple?.[1]).toEqual({});
    expect(tuple?.[2]).toBe("contigs");
  });
});
