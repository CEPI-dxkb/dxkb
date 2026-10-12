import type { Page } from "@playwright/test";
import {
  test,
  expect,
  applyBackendMocks,
  type JsonOverride,
} from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  e2eHomePath,
  journeyOverrides,
  mockLifecycleJobs,
  workspaceObjectContentOverride,
  type TupleItem,
} from "../../fixtures/overrides";
import {
  JobsListPage,
  ServiceFormPage,
  ViralGenomeTreePage,
} from "../../pages";

/**
 * Deep submission spec for the phylogenetic-tree service family.
 *
 * Group representative: `/services/viral-genome-tree`. The Gene/Protein Tree page shares the
 * same `useServiceRuntime` plumbing, the same SelectedSequencesTable input pattern, and the same
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
      owner: "e2e-test-user",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        // buildWorkspaceOverrides covers Workspace.ls / Workspace.get / Workspace.list_permissions
        // for the output-folder selector and the post-submit /jobs workspace sidebar chrome.
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides({
          jobs: [submittedJob, ...mockLifecycleJobs],
          submitResponse: { job: [submittedJob] },
        }),
        ...journeyOverrides,
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

    await page.getByRole("button", { name: "View Job", exact: true }).click();
    await expect(page).toHaveURL(/\/jobs(?:\?|$|\/)/);
    const jobs = new JobsListPage(page);
    await jobs.waitForRows();
    await expect(jobs.rowById(submittedJob.id)).toBeVisible();
  });
});


/**
 * Every outcome of the Input card's three Add buttons ends in a deliberate
 * toast or a new row in the selected list, never an uncaught error or a raw
 * TypeError toast (a group whose `genome_id` was one string used to toast
 * "….filter is not a function"). The hook's branches are unit tested; these
 * journeys cover what only a browser shows: the selector → Add → row path and
 * the toast as rendered, line breaks included.
 */
test.describe("viral genome tree inputs", () => {
  const groupParent = `${e2eHomePath}/Genome Groups`;
  const sequenceParent = `${e2eHomePath}/Sequences`;
  const viralGroup: TupleItem = {
    name: "H5N1_2024_isolates",
    type: "genome_group",
    parentPath: groupParent,
  };
  const bacterialGroup: TupleItem = {
    name: "Haemophilus_influenzae_ampicillin_resistance",
    type: "genome_group",
    parentPath: groupParent,
  };
  const emptyGroup: TupleItem = {
    name: "Empty_viral_group",
    type: "genome_group",
    parentPath: groupParent,
  };
  const alignedFasta: TupleItem = {
    name: "h5n1-ha-aligned.fasta",
    type: "aligned_dna_fasta",
    parentPath: sequenceParent,
  };
  const unalignedFasta: TupleItem = {
    name: "h5n1-ha-unaligned.fasta",
    type: "feature_dna_fasta",
    parentPath: sequenceParent,
  };
  // The mocked search answers every selector with this whole list; each
  // selector keeps only the types it accepts.
  const searchItems = [
    viralGroup,
    bacterialGroup,
    emptyGroup,
    alignedFasta,
    unalignedFasta,
  ];

  function pathOf(item: TupleItem): string {
    return `${item.parentPath}/${item.name}`;
  }

  function groupContent(
    item: TupleItem,
    genomeIds: string[] | string,
  ): JsonOverride {
    return workspaceObjectContentOverride(
      item,
      JSON.stringify({ name: item.name, id_list: { genome_id: genomeIds } }),
    );
  }

  /** validate-viral answering only for exactly `genomeIds`, so a wrong id list goes unmocked. */
  function validateViral(
    genomeIds: string[],
    response: { status?: number; body: object },
  ): JsonOverride {
    return {
      url: /\/api\/services\/genome\/validate-viral$/,
      method: "POST",
      matchBody: (parsed) => {
        const ids = (parsed as { genome_ids?: unknown } | null)?.genome_ids;
        return JSON.stringify(ids) === JSON.stringify(genomeIds);
      },
      ...response,
    };
  }

  const rawErrorText = /is not a function|Cannot read properties/;

  /**
   * Records uncaught page errors and the text of every toast shown, including
   * ones that time out before the test ends.
   */
  async function watchForRawErrors(page: Page) {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const seen = new Set<string>();
      Object.assign(window, { e2eToastTexts: seen });
      new MutationObserver(() => {
        for (const toast of document.querySelectorAll("[data-sonner-toast]")) {
          seen.add(toast.textContent);
        }
      }).observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    return async () => {
      const toastTexts = await page.evaluate(() => [
        ...(window as unknown as { e2eToastTexts: Set<string> }).e2eToastTexts,
      ]);
      expect(pageErrors, "uncaught page errors").toEqual([]);
      // Every scenario here ends in a toast, so an empty log means the
      // recorder is broken, not that the page stayed quiet.
      expect(toastTexts, "toasts recorded").not.toEqual([]);
      expect(
        toastTexts.filter((text) => rawErrorText.test(text)),
        "toasts showing a raw JS error",
      ).toEqual([]);
    };
  }

  let expectNoRawErrors: () => Promise<void>;

  test.beforeEach(async ({ page }) => {
    expectNoRawErrors = await watchForRawErrors(page);
  });

  test.afterEach(async () => {
    await expectNoRawErrors();
  });

  /** Mock the backends, the scenario's own overrides first (first match wins), and open the form. */
  async function openForm(page: Page, overrides: JsonOverride[]) {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...overrides,
        ...buildWorkspaceOverrides({ searchItems }),
        ...buildJobsOverrides(),
        ...journeyOverrides,
      ],
    });
    const viralTree = new ViralGenomeTreePage(page);
    await viralTree.goto();
    return viralTree;
  }

  test("a valid viral group is added as a row", async ({ page }) => {
    const genomeIds = ["11320.1001", "11320.1002", "11320.1003"];
    const viralTree = await openForm(page, [
      groupContent(viralGroup, genomeIds),
      validateViral(genomeIds, {
        body: {
          results: genomeIds.map((genomeId) => ({
            genome_id: genomeId,
            superkingdom: "Viruses",
            contigs: 1,
            genome_length: 13500,
          })),
        },
      }),
    ]);

    await viralTree.add("genomeGroup", viralGroup.name);

    expect(await viralTree.toastDescription("Genome group added")).toBe(
      "Added genome group with 3 genomes.",
    );
    await expect(viralTree.selectedRows).toHaveCount(1);
    const row = viralTree.selectedRow(pathOf(viralGroup));
    await expect(row).toContainText(viralGroup.name);
    await expect(row).toContainText("Genome Group");
    // The selector clears once its object is in the list.
    await expect(viralTree.selector("genomeGroup")).toHaveValue("");
  });

  test("a group stored as one comma-separated id string is validated and rejected with alpha's message", async ({
    page,
  }) => {
    const genomeIds = ["727.1510", "727.1511"];
    const viralTree = await openForm(page, [
      // Some older groups store `genome_id` as one string rather than a
      // list; reading it used to throw "….filter is not a function".
      groupContent(bacterialGroup, genomeIds.join(",")),
      validateViral(genomeIds, {
        body: {
          results: [
            { genome_id: "727.1510", superkingdom: "Bacteria", contigs: 40, genome_length: 1900000 },
            { genome_id: "727.1511", superkingdom: "Bacteria", contigs: 38, genome_length: 1850000 },
          ],
        },
      }),
    ]);

    await viralTree.add("genomeGroup", bacterialGroup.name);

    // innerText follows the rendering, so it only keeps the line breaks if
    // the description's white-space keeps them (layout.tsx's toastOptions).
    expect(
      await viralTree.toastDescription("Genome group validation failed"),
    ).toBe(
      [
        "This looks like an invalid genome group. The following errors were found:",
        "- Invalid Superkingdom: only virus genomes are permitted",
        "First occurrence for genome_id: 727.1510",
        "- Error: only 1 contig is permitted",
        "First occurrence for genome_id: 727.1510",
        "- Error: genome exceeds maximum length 250000",
        "First occurrence for genome_id: 727.1510",
      ].join("\n"),
    );
    await expect(viralTree.toast("Validation error")).toHaveCount(0);
    await expect(viralTree.emptySelection).toBeVisible();
    await viralTree.expectAddReady("genomeGroup");
  });

  test("an empty group is refused without validating it", async ({ page }) => {
    // No validate-viral mock: the strict guard fails the test if it is called.
    const viralTree = await openForm(page, [groupContent(emptyGroup, [])]);

    await viralTree.add("genomeGroup", emptyGroup.name);

    expect(await viralTree.toastDescription("Empty genome group")).toBe(
      "The selected genome group is empty.",
    );
    await expect(viralTree.emptySelection).toBeVisible();
    await viralTree.expectAddReady("genomeGroup");
  });

  // A failed group read, as the workspace proxy (src/app/api/services/
  // workspace/route.ts) answers when BV-BRC fails, and as a bare JSON-RPC
  // error. Either way the toast shows the backend's own message.
  for (const [shape, body] of [
    [
      "the workspace proxy's error",
      {
        error: "BV-BRC API error: 500 Internal Server Error",
        apiResponse: { code: -32000, message: "_ERROR_Object not found_ERROR_" },
      },
    ],
    [
      "a JSON-RPC error",
      { error: { code: -32000, message: "Object not found" } },
    ],
  ] as const) {
    test(`a group that cannot be read (${shape}) shows the backend's message and frees the Add button`, async ({
      page,
    }) => {
      const viralTree = await openForm(page, [
        { ...groupContent(viralGroup, []), status: 500, body },
      ]);

      await viralTree.add("genomeGroup", viralGroup.name);

      expect(await viralTree.toastDescription("Validation error")).toBe(
        "Object not found",
      );
      await expect(viralTree.emptySelection).toBeVisible();
      await viralTree.expectAddReady("genomeGroup");
    });
  }

  test("a failed viral validation request shows the route's message", async ({
    page,
  }) => {
    const genomeIds = ["11320.1001", "11320.1002", "11320.1003"];
    const viralTree = await openForm(page, [
      groupContent(viralGroup, genomeIds),
      validateViral(genomeIds, {
        status: 502,
        body: { error: "BV-BRC genome validation failed: 502 Bad Gateway" },
      }),
    ]);

    await viralTree.add("genomeGroup", viralGroup.name);

    expect(await viralTree.toastDescription("Validation error")).toBe(
      "BV-BRC genome validation failed: 502 Bad Gateway",
    );
    await expect(viralTree.emptySelection).toBeVisible();
    await viralTree.expectAddReady("genomeGroup");
  });

  test("aligned and unaligned FASTA files are added as typed rows, and a repeat is refused", async ({
    page,
  }) => {
    const viralTree = await openForm(page, []);

    await viralTree.add("alignedFasta", alignedFasta.name);
    await viralTree.add("unalignedFasta", unalignedFasta.name);

    await expect(viralTree.selectedRows).toHaveCount(2);
    const alignedRow = viralTree.selectedRow(pathOf(alignedFasta));
    await expect(alignedRow).toContainText(alignedFasta.name);
    await expect(alignedRow).toContainText("Aligned DNA FASTA");
    const unalignedRow = viralTree.selectedRow(pathOf(unalignedFasta));
    await expect(unalignedRow).toContainText(unalignedFasta.name);
    await expect(unalignedRow).toContainText("Unaligned DNA FASTA");

    await viralTree.add("alignedFasta", alignedFasta.name);

    expect(
      await viralTree.toastDescription("Duplicate selection detected"),
    ).toBe("Aligned DNA FASTA is already selected.");
    await expect(viralTree.selectedRows).toHaveCount(2);
  });
});
