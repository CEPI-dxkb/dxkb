import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildWorkspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";
import { SignInPage, WorkspacePage } from "../pages";

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

// Replays the auth section of the recorded `workspace-upload.har` to validate
// the live BV-BRC sign-in response shape. Same caveat as the other journey
// HAR replay tests: post-auth upload traffic isn't exercised here because
// `Set-Cookie` is scrubbed by the recorder, so the middleware-gated workspace
// route can't be unlocked from a HAR-only sign-in. The override-based test
// above covers the upload + post-upload `Workspace.ls` shape; this one closes
// the auth-shape loop against the same HAR the manual-dispatch write-group
// refresh re-records.
test.describe("workspace upload via recorded HAR replay", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("auth flow hydrates from recorded HAR", async ({ page }) => {
    await applyBackendMocks(page, { har: "workspace-upload.har" });

    const signIn = new SignInPage(page);
    await signIn.goto();

    const signInResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/auth/sign-in/email") &&
        res.request().method() === "POST",
    );
    await signIn.fill("e2e-test-user", "REDACTED-PASSWORD");
    await signIn.submit();
    const res = await signInResponse;
    const body = (await res.json()) as {
      user?: Record<string, unknown>;
      session?: Record<string, unknown>;
    };
    expect(body.user).toMatchObject({
      username: "e2e-test-user",
      realm: "bvbrc",
      email_verified: true,
    });
    expect(body.session).toHaveProperty("expiresAt");
    await expect(page).toHaveURL(/\/$/);
  });
});
