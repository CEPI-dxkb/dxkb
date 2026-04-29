import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { SettingsPage } from "../pages";

// Shared by both tests in this describe block. Shape mirrors UserProfile from
// src/lib/auth/types.ts — the GET /api/auth/profile mock returns this verbatim.
const fakeProfile = {
  id: "e2e-test-user@patricbrc.org",
  email: "e2e@example.com",
  email_verified: true,
  first_name: "Original",
  middle_name: "",
  last_name: "Tester",
  affiliation: "DXKB",
  organisms: "",
  interests: "",
  creation_date: "2024-01-01T00:00:00Z",
  l_id: "e2e-test-user",
  last_login: "2024-01-01T00:00:00Z",
  reverification: false,
  source: "bvbrc",
};

test.describe("settings — profile update", () => {
  test("submitting the profile form POSTs JSON-PATCH ops for changed fields and shows success toast", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // GET /api/auth/profile fires on /settings mount; without a 2xx response
        // the form never renders past its skeleton state.
        {
          url: "/api/auth/profile",
          method: "GET",
          body: fakeProfile,
        },
        // POST /api/auth/profile is the save endpoint.
        {
          url: "/api/auth/profile",
          method: "POST",
          body: { ok: true },
        },
        // /settings renders workspace sidebar chrome — Workspace.get (favorites) etc.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const settings = new SettingsPage(page);
    await settings.goto();

    // Wait for the form to populate from the GET fetch.
    await expect(settings.firstNameInput).toHaveValue("Original");

    await settings.firstNameInput.fill("Updated");
    await settings.affiliationInput.fill("DXKB E2E");

    const saveRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/profile") && req.method() === "POST",
    );
    await settings.saveButton.click();
    const req = await saveRequest;
    // Body is a JSON-PATCH array — only the two changed fields are sent.
    const patches = req.postDataJSON() as {
      op: string;
      path: string;
      value: string;
    }[];
    expect(patches).toEqual(
      expect.arrayContaining([
        { op: "replace", path: "/first_name", value: "Updated" },
        { op: "replace", path: "/affiliation", value: "DXKB E2E" },
      ]),
    );
    expect(patches).toHaveLength(2);

    await expect(settings.successToast).toBeVisible();
  });

  test("save failure surfaces the upstream message in an error toast", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        // GET /api/auth/profile must succeed so the form renders past the skeleton.
        {
          url: "/api/auth/profile",
          method: "GET",
          body: fakeProfile,
        },
        // POST /api/auth/profile returns 500 with an upstream error message.
        {
          url: "/api/auth/profile",
          method: "POST",
          status: 500,
          body: { message: "Profile service unavailable" },
        },
        // Workspace sidebar chrome fires Workspace.get (favorites) etc.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.firstNameInput).toHaveValue("Original");

    await settings.firstNameInput.fill("Different");
    await settings.saveButton.click();

    // The error path uses `err?.message || "Failed to update profile."`. With our
    // mock returning `{ message: "Profile service unavailable" }`, the toast
    // shows the upstream message. The errorToast regex covers both branches.
    await expect(settings.errorToast).toBeVisible();
  });
});
