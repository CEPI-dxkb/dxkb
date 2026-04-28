import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  mockLifecycleJobs,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";
import { JobsListPage, ServiceFormPage } from "../../pages";

/**
 * Deep submission spec for the phylogenetic-tree service family.
 *
 * Group representative: `/services/viral-genome-tree`. The Gene/Protein Tree page shares the
 * same `useServiceRuntime` plumbing, the same SelectedItemsTable input pattern, and the same
 * output-folder + JobParamsDialog tail — so one journey here covers the family's interaction
 * layer (rerun pre-fill → submit → toast → /jobs landing). The one Gene/Protein-Tree-only
 * divergence is the DNA/Protein alphabet toggle that filters incompatible sequences when
 * switched mid-form; that lives in a Vitest page-level test
 * (`gene-protein-tree/__tests__/page-alphabet.test.tsx`) because it is plain React state +
 * a useEffect — testable in jsdom without a real browser.
 *
 * Pre-fill via the rerun mechanism instead of driving the WorkspaceObjectSelector. The
 * Genome Group selector additionally fires a `fetchGenomeGroupMembers` + `validateViralGenomes`
 * pair on click that we'd otherwise have to mock; rerun bypasses that path entirely while still
 * exercising the same `submitFormData` → `app-service/submit` flow we care about.
 */
test.describe("viral genome tree submission (representative for tree-services family)", () => {
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "tree-e2e",
          recipe: "RAxML",
          substitution_model: "GTR",
          trim_threshold: 0.5,
          gap_threshold: 0.5,
          sequences: [
            {
              filename: "/e2e-test-user@patricbrc.org/home/genome-group-a",
              type: "genome_group",
            },
          ],
        }),
      );
    });
  }

  test("submitting a tree job POSTs the expected payload and lands the new job in /jobs", async ({ page }) => {
    const submittedJob = {
      id: "job-new-tree",
      app: "GeneTree",
      status: "queued" as const,
      submit_time: "2026-04-28T12:00:00Z",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides({
          jobs: [submittedJob, ...mockLifecycleJobs],
          submitResponse: { job: [submittedJob] },
        }),
        ...permissiveBackendOverrides,
      ],
    });

    await preFillRerunData(page);

    const form = new ServiceFormPage(page, /viral genome tree/i);
    await form.goto("/services/viral-genome-tree?rerun_key=e2e-rerun");

    // Output-name input reflecting the rerun value is the proxy for "rerun applied" — the page's
    // `onApply` runs on mount and writes output_file alongside sequences/thresholds in one shot.
    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue("tree-e2e");
    // Submit only enables once tanstack-form's `canSubmit` flips true; the schema enforces
    // sequences.length >= 1, so this is also a guarantee the rerun-supplied sequence was applied.
    const submitButton = page.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled();

    const submitRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/submit") &&
        req.method() === "POST",
    );
    await submitButton.click();

    const req = await submitRequest;
    const payload = req.postDataJSON() as {
      app_name?: string;
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_name).toBe("GeneTree");
    expect(payload.app_params).toMatchObject({
      alphabet: "DNA",
      tree_type: "viral_genome",
      recipe: "RAxML",
      substitution_model: "GTR",
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "tree-e2e",
    });
    // The sequences array is the difference between a real workspace selection round-tripping
    // through rerun and the form silently dropping the input — same shape concern that drives
    // the `paired_end_libs` assertion in genome-assembly.spec.ts.
    const sequences = payload.app_params?.sequences as
      | { filename?: string; type?: string }[]
      | undefined;
    expect(Array.isArray(sequences)).toBe(true);
    expect(sequences?.[0]).toMatchObject({
      filename: "/e2e-test-user@patricbrc.org/home/genome-group-a",
      type: "genome_group",
    });

    await page.getByRole("button", { name: /view job/i }).click();
    await expect(page).toHaveURL(/\/jobs(?:\?|$|\/)/);
    const jobs = new JobsListPage(page);
    await jobs.waitForRows();
    await expect(jobs.rowById(submittedJob.id)).toBeVisible();
  });
});
