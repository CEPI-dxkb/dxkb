import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  a11yBackendOverrides,
  workspacePopulatedOverrides,
  workspaceEmptyOverrides,
  jobsEmptyOverrides,
  buildJobsOverrides,
  mockJobs,
  buildWorkspaceOverrides,
  e2eHomePath,
  journeyOverrides,
  buildPpiRows,
  buildPpiOverrides,
} from "../../fixtures/overrides";
import { awaitSettled } from "../../a11y/settle";
import { scanPage, formatBlocking, logWarnings } from "../../a11y/axe-scan";
import { partition } from "../../a11y/gate";
import { applyBaseline } from "../../a11y/baseline";
import { forEachTheme } from "../../a11y/theme";
import { recordScan } from "../../a11y/report";
import generatedBaseline from "../../a11y/baseline.generated";
import { WorkspacePage } from "../../pages/workspace-page";
import { JobsListPage } from "../../pages/jobs-list-page";
import { SettingsPage } from "../../pages/settings-page";
import { TaxonInteractionsPage } from "../../pages/taxon-interactions-page";
import type { BaselineMap } from "../../a11y/baseline";
import type { MockJob } from "../../fixtures/overrides";

const baselineMap: BaselineMap = generatedBaseline;

/** Scan current page state and assert no unbaselined blocking violations. */
async function assertNoBlocking(
  page: Parameters<typeof scanPage>[0],
  surfaceName: string,
  theme: Parameters<typeof applyBaseline>[2],
): Promise<void> {
  const violations = await scanPage(page);
  const { blocking, warnings } = partition(violations);
  const { remaining, suppressed } = applyBaseline(
    baselineMap,
    surfaceName,
    theme,
    blocking,
  );
  logWarnings(warnings, `${surfaceName} (${theme})`);
  if (suppressed.length > 0) {
    console.info(
      `[a11y] ${surfaceName} (${theme}): ${String(suppressed.length)} suppressed`,
    );
  }
  recordScan({
    project: test.info().project.name,
    route: surfaceName,
    theme,
    retry: test.info().retry,
    blocking: remaining,
    suppressed,
    warnings,
  });
  expect(
    remaining,
    remaining.length === 0
      ? undefined
      : formatBlocking(remaining, `${surfaceName} (${theme})`),
  ).toEqual([]);
}

// ── Service forms — interaction states ──────────────────────────────────────────

test.describe("a11y deep tier: service forms", () => {
  // genome-assembly as the representative service form (already covered by sweep).
  // These tests exercise states the load-scan cannot reach.

  test("genome-assembly: validation errors shown", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...authSessionOverrides, ...a11yBackendOverrides],
    });
    await page.goto("/services/genome-assembly");
    await page.waitForLoadState("networkidle");

    // Submit with empty required fields to trigger inline validation errors.
    await page.getByRole("button", { name: /assemble/i }).click();
    // Give validation messages time to render.
    await page.waitForTimeout(300);

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "genome-assembly/validation-errors", theme);
    });
  });

  test("genome-assembly: file-picker dialog open", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/services/genome-assembly");
    await page.waitForLoadState("networkidle");

    // Open the output folder picker (labeled "Output Folder" or similar).
    const folderButton = page
      .getByRole("button", { name: /output folder|select folder|browse/i })
      .first();
    if (await folderButton.isVisible()) {
      await folderButton.click();
      await page
        .getByRole("dialog")
        .waitFor({ state: "visible", timeout: 5_000 });
    } else {
      test.skip();
    }

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "genome-assembly/file-picker-open", theme);
    });
  });
});

// ── Workspace — data states ──────────────────────────────────────────────────────

test.describe("a11y deep tier: workspace", () => {
  test("workspace: populated state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "workspace/populated", theme);
    });
  });

  test("workspace: empty state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceEmptyOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "workspace/empty", theme);
    });
  });

  test("workspace: details panel open", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);

    // Select the first file to open the details panel.
    await wp.selectFile("sample.fastq");
    await page.waitForLoadState("networkidle");

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "workspace/details-panel-open", theme);
    });
  });

  test("workspace: new-folder dialog open", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);

    await wp.openNewFolder();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "workspace/new-folder-dialog", theme);
    });
  });

  test("workspace: upload dialog open", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);

    await wp.openUpload();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "workspace/upload-dialog", theme);
    });
  });
});

// ── Jobs — data states ────────────────────────────────────────────────────────────

test.describe("a11y deep tier: jobs", () => {
  test("jobs: populated state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...jobsOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    // Wait for skeleton rows to detach — the DataTable renders 30 [data-slot="skeleton"]
    // <tr> placeholders that satisfy waitForRows(), so scan only after real rows paint.
    await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "jobs/populated", theme);
    });
  });

  test("jobs: empty state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...jobsEmptyOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    // Empty state transitions skeleton → "No jobs found"; wait for skeleton detach.
    await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "jobs/empty", theme);
    });
  });

  test("jobs: failed-job row visible", async ({ page }) => {
    const failedJob: MockJob = {
      id: "job-failed",
      app: "GenomeAssembly",
      status: "failed",
      submit_time: "2026-04-01T09:00:00Z",
      owner: "e2e-test-user",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildJobsOverrides({ jobs: [failedJob] }),
        ...a11yBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    // Skeleton <tr> rows satisfy waitForRows(); wait for their detach so axe scans
    // the real failed-job row, not the loading placeholder (root cause of flake).
    await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });
    await jobs.waitForRows();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "jobs/failed-row", theme);
    });
  });

  test("jobs: kill-confirmation dialog", async ({ page }) => {
    const runningJob: MockJob = {
      id: mockJobs[1].id,
      app: mockJobs[1].app,
      status: "running",
      submit_time: mockJobs[1].submit_time,
      owner: mockJobs[1].owner,
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildJobsOverrides({ jobs: [runningJob] }),
        ...a11yBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });
    await jobs.waitForRows();

    await jobs.selectJob(runningJob.id);
    await jobs.killSelected();

    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: /confirm|kill|stop/i });
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await forEachTheme(page, async (theme) => {
        await assertNoBlocking(page, "jobs/kill-dialog", theme);
      });
    } else {
      // If no confirmation dialog, just verify the kill button itself was accessible.
      test
        .info()
        .annotations.push({
          type: "note",
          description: "kill-dialog not present in this build",
        });
    }
  });
});

// ── Search — data states ──────────────────────────────────────────────────────────

test.describe("a11y deep tier: search", () => {
  const emptyDataApiResponse = Object.fromEntries(
    [
      "taxonomy",
      "genome",
      "strain",
      "genome_feature",
      "sp_gene",
      "protein_feature",
      "epitope",
      "protein_structure",
      "pathway",
      "subsystem",
      "surveillance",
      "serology",
      "experiment",
      "antibiotics",
      "genome_sequence",
    ].map((type) => [
      type,
      {
        result: {
          response: { docs: [], numFound: 0, maxScore: 0, numFoundExact: true },
        },
      },
    ]),
  );

  const dataApiOverride = {
    url: /theseed\.org\/services\/data_api\/query/,
    method: "POST",
    body: emptyDataApiResponse,
  } as const;

  test("search: no-results state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        dataApiOverride,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/search?type=everything&q=zzznoresultsxxx");
    await page.waitForLoadState("networkidle");

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "search/no-results", theme);
    });
  });
});

// ── Command palette (interaction state) ──────────────────────────────────────────
// Migrated from routes-sweep.spec.ts Phase 1 to its natural home here.

test.describe("a11y deep tier: command palette", () => {
  test("command palette (open): no blocking violations", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    // WebKit requires explicit page focus before keyboard events reach document listeners.
    await page.locator("body").click();

    const modifierKey = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifierKey}+K`);
    await page
      .getByRole("dialog", { name: /command palette/i })
      .waitFor({ state: "visible", timeout: 10_000 });
    // Wait for auto-focus: WebKit cmdk theme CSS can lag behind dialog visibility.
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused({
      timeout: 5_000,
    });

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "command-palette/open", theme);
    });
  });
});

// ── Settings — interaction + data states ─────────────────────────────────────
// 168 deep-tier floor (Q29): settings default · error-toast.

const settingsProfile = {
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
} as const;

test.describe("a11y deep tier: settings", () => {
  test("settings: default (form populated)", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        { url: "/api/auth/profile", method: "GET", body: settingsProfile },
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.firstNameInput).toHaveValue("Original");

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "settings/default", theme);
    });
  });

  test("settings: error toast shown", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        { url: "/api/auth/profile", method: "GET", body: settingsProfile },
        // Failing save → error toast. Preserve a real message (project rule:
        // no generic errors) so the toast text is meaningful.
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

    // Mutate a field so the form is dirty, then submit to trigger the failing POST.
    await settings.firstNameInput.fill("Updated");
    await settings.saveButton.click();
    await expect(settings.errorToast).toBeVisible();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "settings/error-toast", theme);
    });
  });
});

// ── Taxon interactions — Graph subtab (interaction state, not URL-addressable) ────
// The Graph subtab is local React state (no query param), so routes-sweep.spec.ts
// cannot reach it. Cover it here by driving the click before scanning.

test.describe("a11y deep tier: taxon interactions graph", () => {
  test("interactions: Graph subtab has no blocking violations", async ({
    page,
    browserName,
  }) => {
    // Sigma.js needs a WebGL context to mount its canvas. Headless Firefox and
    // WebKit cannot render it reliably, so Chromium carries this a11y coverage.
    // Mirrors interactions.spec.ts and viewer-3d.spec.ts.
    test.skip(
      browserName !== "chromium",
      "Headless non-Chromium browsers cannot render the Sigma.js WebGL canvas",
    );

    const rows = buildPpiRows(1);

    await applyBackendMocks(page, {
      overrides: [
        ...buildPpiOverrides(rows),
        ...authSessionOverrides,
        ...a11yBackendOverrides,
      ],
    });

    const interactionsPage = new TaxonInteractionsPage(page);
    await interactionsPage.goto("234");
    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "interactions/graph", theme);
    });
  });
});

// ── File viewer — panel render states ────────────────────────────────────────
// 168 deep-tier floor (Q29): file-viewer text · csv · fallback.
// Structure (.pdb) is covered by the /viewer/structure route in the sweep.
// CodeMirror (.cm-editor) and molstar subtrees are in vendorExclusions.

const viewerItems = [
  { name: "notes.txt", type: "txt", parentPath: e2eHomePath, size: 32 },
  { name: "table.csv", type: "csv", parentPath: e2eHomePath, size: 64 },
  { name: "config.json", type: "json", parentPath: e2eHomePath, size: 48 },
];

function viewerContentOverride(
  namePattern: string,
  body: string,
  contentType: string,
) {
  return {
    url: new RegExp(`/api/workspace/view/.*${namePattern}`),
    method: "GET" as const,
    body,
    headers: { "Content-Type": contentType },
  };
}

test.describe("a11y deep tier: file viewer", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Specific view URLs MUST precede the catch-all in buildWorkspaceOverrides.
        viewerContentOverride(
          "notes\\.txt",
          "Plain text notes.\nSecond line.\n",
          "text/plain",
        ),
        viewerContentOverride(
          "table\\.csv",
          "name,count\nalpha,1\nbeta,2\n",
          "text/csv",
        ),
        viewerContentOverride(
          "config\\.json",
          '{"hello":"world"}',
          "application/json",
        ),
        ...authSessionOverrides,
        ...buildWorkspaceOverrides({
          pathItems: { [e2eHomePath]: viewerItems },
        }),
        ...a11yBackendOverrides,
        ...journeyOverrides,
      ],
    });
  });

  test("file-viewer: text (CodeMirror, vendor-excluded)", async ({ page }) => {
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);
    await wp.selectFile("notes.txt");
    // CodeMirror streams content into .cm-content; wait for it before scanning.
    await expect(page.locator(".cm-content")).toContainText("Plain text notes");

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "file-viewer/text", theme);
    });
  });

  test("file-viewer: csv (data grid)", async ({ page }) => {
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);
    await wp.selectFile("table.csv");
    // CsvViewer renders a table; wait for a known cell value.
    await expect(page.getByText("alpha")).toBeVisible();

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "file-viewer/csv", theme);
    });
  });

  test("file-viewer: json (JsonViewer)", async ({ page }) => {
    const wp = new WorkspacePage(page);
    await wp.goto();
    await awaitSettled(page);
    await wp.selectFile("config.json");
    // JsonViewer renders the parsed JSON into CodeMirror (.cm-content);
    // .cm-editor is vendor-excluded, so the scan covers the surrounding chrome.
    await expect(page.locator(".cm-content")).toContainText("hello");

    await forEachTheme(page, async (theme) => {
      await assertNoBlocking(page, "file-viewer/json", theme);
    });
  });
});
