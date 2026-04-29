import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  journeyOverrides,
} from "../../fixtures/overrides";
import { ServiceFormPage } from "../../pages";

test.describe("blast submission (sequence-input family)", () => {
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-blast-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "blast-e2e",
          input_source: "fasta_data",
          input_fasta_data: ">seq\nACGTACGTACGT\n",
          db_type: "fna",
        }),
      );
    });
  }

  test("submitting a BLAST query POSTs the expected app_params payload", async ({
    page,
  }) => {
    const submittedJob = {
      id: "job-blast",
      app: "Homology",
      status: "queued" as const,
      submit_time: "2026-04-24T12:00:00Z",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides({
          jobs: [submittedJob],
          submitResponse: { job: [submittedJob] },
        }),
        ...journeyOverrides,
      ],
    });

    await preFillRerunData(page);

    const form = new ServiceFormPage(page, /^blast$/i);
    await form.goto("/services/blast?rerun_key=e2e-blast-rerun");

    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue(
      "blast-e2e",
    );
    await expect(
      page.getByRole("button", { name: /^submit$/i }),
    ).toBeEnabled();

    const submitRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/submit") &&
        req.method() === "POST",
    );
    await form.submit(/^submit$/i);
    const req = await submitRequest;
    const payload = req.postDataJSON() as {
      app_name?: string;
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_name).toBe("Homology");
    expect(payload.app_params).toMatchObject({
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "blast-e2e",
      input_source: "fasta_data",
      input_fasta_data: ">seq\nACGTACGTACGT\n",
      blast_program: "blastn",
    });
  });
});
