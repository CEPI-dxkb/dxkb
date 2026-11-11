import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  journeyOverrides,
  workspaceRpcOverride,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";
import { recordedTestUserId } from "../scripts/har-constants";
import { harOverridesFor, uploadedFilenameFromHar } from "../scripts/har-overrides";

test.describe("workspace upload", () => {
  test("uploads a file through the dialog and the new row appears in the listing", async ({ page }) => {
    // reflectUploads appends the uploaded file to the mocked listing, so a UI that
    // fails to invalidate the listing would fail.
    await applyBackendMocks(page, {
      overrides: [
        // Must come before journeyOverrides (first match wins).
        ...buildWorkspaceOverrides({ reflectUploads: true }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await expect(workspace.rowByName("sample.txt")).toHaveCount(0);
    await workspace.openUpload();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "sample.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello e2e upload"),
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("sample.txt")).toBeVisible();

    const uploadRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/workspace/upload") &&
        req.method() === "POST",
    );

    await dialog.getByRole("button", { name: /^start upload$/i }).click();
    const req = await uploadRequest;
    expect(req.method()).toBe("POST");

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(workspace.rowByName("sample.txt").first()).toBeVisible();
  });

  test("deletes the new entry when the file never reaches storage", async ({ page }) => {
    // Workspace.create runs before the file is sent; when the upload proxy fails the
    // dialog must delete that object. jsdom cannot send the multipart body.
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/services\/workspace\/upload/,
          method: "POST",
          status: 502,
          body: { error: "Shock refused the upload" },
        },
        ...buildWorkspaceOverrides({
          extraRpc: [workspaceRpcOverride("Workspace.delete", { result: [[]] })],
        }),
        ...journeyOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.openUpload();
    await page.locator('input[type="file"]').setInputFiles({
      name: "sample.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello e2e upload"),
    });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("sample.txt")).toBeVisible();

    const deleteRequest = page.waitForRequest((req) => {
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
    await dialog.getByRole("button", { name: /^start upload$/i }).click();

    const body = JSON.parse((await deleteRequest).postData() ?? "{}") as {
      params?: [{ objects?: string[] }];
    };
    expect(body.params?.[0]?.objects).toEqual([`${e2eHomePath}/sample.txt`]);
    await expect(page.getByText("Upload failed: sample.txt")).toBeVisible();
    await expect(page.getByText("Shock refused the upload")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^start upload$/i })).toBeEnabled();
  });
});

// Replays workspace-upload.har; the two Workspace.ls entries are served in order via
// callIndex, and the upload POST matches by URL and method only.
test.describe("workspace upload via recorded HAR replay", () => {
  test("uploads a file and the recorded post-upload listing renders the new row", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("workspace-upload.har"),
      ],
    });

    await page.goto(
      `/workspace/${encodeURIComponent(recordedTestUserId)}/home/.e2e-records`,
    );

    const workspace = new WorkspacePage(page);
    await expect(workspace.breadcrumbs).toBeVisible();
    await workspace.openUpload();

    await page.locator('input[type="file"]').setInputFiles({
      name: "spec-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("e2e replay upload\n"),
    });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("spec-upload.txt")).toBeVisible();
    await dialog.getByRole("button", { name: /^start upload$/i }).click();
    await expect(dialog).toBeHidden();

    // The recorded post-upload Workspace.ls names the recorder's timestamped file;
    // recover it from the HAR so re-records need no edits.
    const newFile = uploadedFilenameFromHar("workspace-upload.har");
    await expect(workspace.rowByName(newFile).first()).toBeVisible();
  });
});
