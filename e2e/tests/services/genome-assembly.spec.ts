import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";
import { ServiceFormPage } from "../../pages";

test.describe("genome assembly submission", () => {
  /**
   * Pre-fill the form via the rerun mechanism instead of driving the WorkspaceObjectSelector
   * (which requires typing, waiting for its async search dropdown, and clicking a portal-rendered
   * listbox). `useRerunForm` reads a sessionStorage blob keyed by `?rerun_key=` on mount and
   * copies the declared fields + SRA ids onto the form in one shot, which bypasses the selector
   * entirely and keeps the test focused on submission behaviour.
   */
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "assembly-e2e",
          recipe: "unicycler",
          srr_ids: ["SRR123456"],
        }),
      );
    });
  }

  test("submitting the pre-filled form POSTs the expected app payload", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides({
          submitResponse: {
            job: [
              {
                id: "job-new-assembly",
                app: "GenomeAssembly2",
                status: "queued",
                submit_time: "2026-04-24T12:00:00Z",
              },
            ],
          },
        }),
        ...permissiveBackendOverrides,
      ],
    });

    await preFillRerunData(page);

    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly?rerun_key=e2e-rerun");

    // Wait for the output-name input to reflect the rerun value so we know the form has
    // hydrated before we click submit.
    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue("assembly-e2e");

    const submitRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/submit") &&
        req.method() === "POST",
    );
    await form.submit(/assemble/i);

    const req = await submitRequest;
    const payload = req.postDataJSON() as {
      app_name?: string;
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_name).toBe("GenomeAssembly2");
    expect(payload.app_params).toMatchObject({
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "assembly-e2e",
      recipe: "unicycler",
    });
    expect(payload.app_params?.srr_ids).toEqual(
      expect.arrayContaining(["SRR123456"]),
    );
  });

  test("renders the form heading", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides(),
        ...permissiveBackendOverrides,
      ],
    });
    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly");
    await expect(form.heading).toBeVisible();
    await expect(page.getByRole("button", { name: /assemble/i })).toBeVisible();
  });
});
