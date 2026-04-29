import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  journeyOverrides,
} from "../../fixtures/overrides";
import { ServiceFormPage } from "../../pages";

test.describe("proteome-comparison submission (genome-id-input family)", () => {
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-pc-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "pc-e2e",
          // 1-based index into the combined [genome_ids, user_genomes, user_feature_groups]
          // ordering. reference_genome_index = 3 picks the third genome_id below as the
          // reference; the remaining two become comparison items.
          genome_ids: ["83332.111", "83333.111", "511145.12"],
          reference_genome_index: 3,
          max_e_val: "1e-5",
        }),
      );
    });
  }

  test("submitting a proteome comparison POSTs the expected genome_ids payload", async ({
    page,
  }) => {
    const submittedJob = {
      id: "job-pc",
      app: "GenomeComparison",
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
        // The proteome-comparison page hydrates the rerun-applied genome IDs into
        // ComparisonItems by looking up display names via /api/services/genome/by-ids.
        {
          url: "/api/services/genome/by-ids",
          method: "POST",
          body: {
            results: [
              { genome_id: "511145.12", genome_name: "Escherichia coli K-12" },
              {
                genome_id: "83332.111",
                genome_name: "Mycobacterium tuberculosis H37Rv",
              },
              {
                genome_id: "83333.111",
                genome_name: "Escherichia coli K-12 MG1655",
              },
            ],
          },
        },
        // SingleGenomeSelector mounts on the reference-genome card and may fire its
        // autocomplete request (`GET /api/services/genome/search?q=&limit=25`) on
        // initial focus. Without this override the call leaks past strict mode.
        {
          url: /\/api\/services\/genome\/search/,
          method: "GET",
          body: { results: [] },
        },
        ...journeyOverrides,
      ],
    });

    await preFillRerunData(page);

    const form = new ServiceFormPage(page, /proteome comparison/i);
    await form.goto("/services/proteome-comparison?rerun_key=e2e-pc-rerun");

    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue(
      "pc-e2e",
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
    expect(payload.app_name).toBe("GenomeComparison");
    expect(payload.app_params).toMatchObject({
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "pc-e2e",
      reference_genome_index: 1,
    });
    // The transform places the reference genome first, then the remaining comparison items.
    expect(payload.app_params?.genome_ids).toEqual([
      "511145.12",
      "83332.111",
      "83333.111",
    ]);
  });
});
