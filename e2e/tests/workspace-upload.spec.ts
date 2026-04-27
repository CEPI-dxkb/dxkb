import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";

test.describe("workspace upload", () => {
  test("uploads a file through the dialog and POSTs to the upload endpoint", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides(),
        ...permissiveBackendOverrides,
      ],
    });
    const workspace = new WorkspacePage(page);
    await workspace.goto();
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
    // FormData request — we only assert the endpoint was hit. Asserting body shape requires
    // browser-side multipart parsing that Playwright doesn't do natively.
  });
});
