import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";
import { recordedTestUserId } from "../scripts/har-constants";
import { harOverridesFor, uploadedFilenameFromHar } from "../scripts/har-overrides";

test.describe("workspace upload", () => {
  test("uploads a file through the dialog and the new row appears in the listing", async ({ page }) => {
    // reflectUploads: Workspace.create echoes the requested filename and appends it to the
    // mocked listing so the post-upload Workspace.ls refresh surfaces the new row. Without this,
    // a UI that uploaded successfully but failed to invalidate the listing would still pass.
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides({ reflectUploads: true }),
        ...permissiveBackendOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    // Make sure we are NOT looking at a stale fixture before the upload.
    await expect(workspace.rowByName("sample.txt")).toHaveCount(0);
    await workspace.openUpload();

    // Playwright's `setInputFiles` bypasses the dropzone click and attaches a file directly to
    // the hidden <input type="file"> so the test does not need to simulate drag-and-drop.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "sample.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello e2e upload"),
    });

    // Confirm the file is queued in the selected-files table before starting upload.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("sample.txt")).toBeVisible();

    // Intercept the upload POST so we can assert the flow actually reached the server.
    const uploadRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/workspace/upload") &&
        req.method() === "POST",
    );

    await dialog.getByRole("button", { name: /^start upload$/i }).click();
    const req = await uploadRequest;
    expect(req.method()).toBe("POST");

    // After upload completes, the dialog closes and the workspace browser re-runs Workspace.ls.
    // The new row must show up — that's the assertion that distinguishes a working upload from
    // a UI that POSTs successfully but never invalidates / re-renders the listing.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(workspace.rowByName("sample.txt").first()).toBeVisible();
  });
});

// Drives the upload journey against post-auth traffic recorded in
// `workspace-upload.har`. The two `Workspace.ls` entries (pre- vs post-upload)
// are served sequentially via `callIndex`, so the second call returns the
// listing that includes the freshly-uploaded row. The upload POST is multipart
// (no JSON-RPC method) so the override matches by URL+method only and serves
// the recorded response regardless of the spec's filename;
// `uploadedFilenameFromHar` recovers the recorder-generated name so re-records
// don't require parallel edits. See `harOverridesFor` for the canary rationale
// (no `permissiveBackendOverrides` here).
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

    // The recorded post-upload `Workspace.ls` names whichever timestamped
    // file the recorder generated this run; pull that name out of the HAR
    // so the assertion stays in sync with the fixture across re-records.
    // If the HAR-derived overrides actually drove the post-upload refetch,
    // the row appears; if the upload POST or the refetch missed the
    // override path, the listing would still show only the pre-upload file.
    const newFile = uploadedFilenameFromHar("workspace-upload.har");
    await expect(workspace.rowByName(newFile).first()).toBeVisible();
  });
});
