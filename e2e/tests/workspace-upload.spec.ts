import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

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
