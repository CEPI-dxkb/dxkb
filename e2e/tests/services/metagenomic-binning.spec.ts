import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  journeyOverrides,
} from "../../fixtures/overrides";
import { ServiceFormPage } from "../../pages";

test.describe("metagenomic-binning submission", () => {
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-mb-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "binning-e2e",
          start_with: "reads",
          assembler: "metaspades",
          organism: "bacteria",
          paired_end_libs: [
            {
              read1: "/e2e-test-user@patricbrc.org/home/sample_R1.fq",
              read2: "/e2e-test-user@patricbrc.org/home/sample_R2.fq",
              platform: "illumina",
              interleaved: false,
            },
          ],
        }),
      );
    });
  }

  test("submitting a metagenomic-binning job POSTs the expected paired_end_libs payload", async ({
    page,
  }) => {
    const submittedJob = {
      id: "job-mb",
      app: "MetagenomeBinning",
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

    const form = new ServiceFormPage(page, /metagenomic binning/i);
    await form.goto("/services/metagenomic-binning?rerun_key=e2e-mb-rerun");

    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue(
      "binning-e2e",
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
    expect(payload.app_name).toBe("MetagenomeBinning");
    // The transform drops `start_with` (it's an internal discriminator) and emits
    // `assembler` only for the `reads` branch; organism="bacteria" becomes
    // `perform_bacterial_annotation: true`.
    expect(payload.app_params).toMatchObject({
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "binning-e2e",
      assembler: "metaspades",
      perform_bacterial_annotation: true,
    });
    const pairedLibs = payload.app_params?.paired_end_libs as
      | { read1?: string; read2?: string }[]
      | undefined;
    expect(Array.isArray(pairedLibs)).toBe(true);
    expect(pairedLibs?.[0]).toMatchObject({
      read1: "/e2e-test-user@patricbrc.org/home/sample_R1.fq",
      read2: "/e2e-test-user@patricbrc.org/home/sample_R2.fq",
    });
  });
});
