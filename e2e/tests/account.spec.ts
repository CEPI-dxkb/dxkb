import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { SettingsPage } from "../pages";

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
        {
          url: "/api/auth/profile",
          method: "GET",
          body: fakeProfile,
        },
        {
          url: "/api/auth/profile",
          method: "POST",
          body: { ok: true },
        },
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const settings = new SettingsPage(page);
    await settings.goto();

    await expect(settings.firstNameInput).toHaveValue("Original");

    await settings.firstNameInput.fill("Updated");
    await settings.affiliationInput.fill("DXKB E2E");

    const saveRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/auth/profile") && req.method() === "POST",
    );
    await settings.saveButton.click();
    const req = await saveRequest;
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
        {
          url: "/api/auth/profile",
          method: "GET",
          body: fakeProfile,
        },
        {
          url: "/api/auth/profile",
          method: "POST",
          status: 500,
          body: { message: "Profile service unavailable" },
        },
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.firstNameInput).toHaveValue("Original");

    await settings.firstNameInput.fill("Different");
    await settings.saveButton.click();

    await expect(settings.errorToast).toBeVisible();
  });
});
