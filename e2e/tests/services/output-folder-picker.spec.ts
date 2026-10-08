import type { Page, Request } from "@playwright/test";
import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  e2eHomePath as home,
  e2eUsername,
  journeyOverrides,
  type TupleItem,
} from "../../fixtures/overrides";
import { FolderPickerDialog, ServiceFormPage } from "../../pages";

/**
 * The Output Folder picker on a real service form (BLAST), against the real
 * JSON-RPC workspace client. Vitest covers the picker's rules and keyboard
 * model in jsdom; this spec covers what jsdom cannot: layout (column widths,
 * the scrolling strip, the pinned info pane, header alignment), mouse drags,
 * the scroll glide frame by frame, the multipart upload, and the chosen
 * folder reaching the submitted job.
 */

function folder(parentPath: string, name: string, extra: Partial<TupleItem> = {}): TupleItem {
  return { name, type: "folder", parentPath, ...extra };
}

const experiments = `${home}/Experiments`;
const run1 = `${experiments}/Run 1`;
const laneA = `${run1}/Lane A`;

/** A home deep enough that the columns overflow the strip at 1280×720. */
function workspaceTree(): Record<string, TupleItem[]> {
  return {
    "/": [
      folder(`/${e2eUsername}`, "home"),
      folder("/bob@patricbrc.org", "Shared Lab", {
        ownerId: "bob@patricbrc.org",
        userPermission: "w",
      }),
      folder("/carol@patricbrc.org", "Read Only", {
        ownerId: "carol@patricbrc.org",
        userPermission: "r",
      }),
      folder("/PATRIC@patricbrc.org", "public", {
        ownerId: "PATRIC@patricbrc.org",
        userPermission: "r",
        globalPermission: "r",
      }),
    ],
    [`/${e2eUsername}`]: [folder(`/${e2eUsername}`, "home")],
    [home]: [
      folder(home, "AMR Workshops"),
      folder(home, "Experiments"),
      folder(home, "FastQ"),
      folder(home, ".hidden"),
      { name: "reads.fq", type: "reads", parentPath: home, size: 2048 },
    ],
    [`${home}/AMR Workshops`]: [],
    [`${home}/FastQ`]: [],
    [experiments]: [
      folder(experiments, "Run 1"),
      folder(experiments, "Run 2"),
      { name: "notes.txt", type: "txt", parentPath: experiments, size: 120 },
    ],
    [`${experiments}/Run 2`]: [],
    [run1]: [folder(run1, "Lane A"), folder(run1, "Lane B")],
    [`${run1}/Lane B`]: [],
    [laneA]: [folder(laneA, "Reads"), folder(laneA, "QC")],
    [`${laneA}/Reads`]: [],
    [`${laneA}/QC`]: [],
  };
}

const campaign = "Sequencing campaign 2026";
const deepFolders = [
  "Batch 01 paired-end reads",
  "Lane group north",
  "Instrument NovaSeq X",
  "Flow cell A22",
  "Sample sheet revision 3",
  "Demultiplexed output",
  "Quality-trimmed reads",
  "Assembly candidates final",
];

/** The usual tree plus a chain of long-named folders nine levels below Home. */
function deepWorkspaceTree(): Record<string, TupleItem[]> {
  const tree = workspaceTree();
  tree[home] = [...tree[home], folder(home, campaign)];
  let parent = `${home}/${campaign}`;
  for (const name of deepFolders) {
    tree[parent] = [folder(parent, name)];
    parent = `${parent}/${name}`;
  }
  tree[parent] = [];
  return tree;
}

async function openBlast(
  page: Page,
  options: {
    pathItems?: Record<string, TupleItem[]>;
    reflectUploads?: boolean;
    reflectFolderCreates?: boolean;
  } = {},
) {
  await applyBackendMocks(page, {
    overrides: [
      ...authSessionOverrides,
      ...buildWorkspaceOverrides({ pathItems: workspaceTree(), ...options }),
      ...buildJobsOverrides(),
      ...journeyOverrides,
    ],
  });
  const form = new ServiceFormPage(page, /^blast$/i);
  await form.goto("/services/blast");
  return { form, picker: new FolderPickerDialog(page) };
}

/** Walk the open picker Home → Experiments → Run 1 → Lane A. */
async function walkToLaneA(picker: FolderPickerDialog) {
  await picker.option("Home", "Experiments").click();
  await picker.option("Experiments", "Run 1").click();
  await picker.option("Run 1", "Lane A").click();
  await expect(picker.option("Lane A", "Reads")).toBeVisible();
  await picker.option("Run 1", "Lane A").focus();
}

/** Open the picker and walk it to Lane A. */
async function openAtLaneA(picker: FolderPickerDialog) {
  await picker.open();
  await walkToLaneA(picker);
}

/** The JSON-RPC method a workspace request calls, or null for any other request. */
function workspaceRpcMethod(request: Request): string | null {
  if (!/\/api\/services\/workspace$/.test(new URL(request.url()).pathname)) {
    return null;
  }
  try {
    return (request.postDataJSON() as { method?: string } | null)?.method ?? null;
  } catch {
    return null;
  }
}

/** Each value is >= the one before it (or <= when `direction` is -1). */
function expectMonotonic(values: number[], direction: 1 | -1) {
  for (let index = 1; index < values.length; index += 1) {
    expect(
      (values[index] - values[index - 1]) * direction,
      `step ${String(index)} of ${values.join(",")}`,
    ).toBeGreaterThanOrEqual(0);
  }
}

test.describe("output folder picker: choosing", () => {
  test("a folder picked by clicking through the columns is the job's output folder", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-blast-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "blast-e2e",
          input_source: "fasta_data",
          input_fasta_data: ">seq\nACGTACGTACGTA\n",
          db_type: "fna",
        }),
      );
    });
    const submittedJob = {
      id: "job-blast",
      app: "Homology",
      status: "queued" as const,
      submit_time: "2026-04-24T12:00:00Z",
      owner: "e2e-test-user",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...buildWorkspaceOverrides({ pathItems: workspaceTree() }),
        ...buildJobsOverrides({
          jobs: [submittedJob],
          submitResponse: { job: [submittedJob] },
        }),
        ...journeyOverrides,
      ],
    });
    const form = new ServiceFormPage(page, /^blast$/i);
    await form.goto("/services/blast?rerun_key=e2e-blast-rerun");
    const picker = new FolderPickerDialog(page);

    await picker.open();
    // It opens on the field's current value: Home.
    await expect(picker.selectButton).toHaveAccessibleName("Select “Home”");
    await picker.option("Home", "Experiments").click();
    await picker.option("Experiments", "Run 1").click();
    await expect(picker.selectButton).toHaveAccessibleName("Select “Run 1”");
    expect(await picker.breadcrumbLabels()).toEqual([
      "Home",
      "Experiments",
      "Run 1",
    ]);
    await picker.selectButton.click();
    await expect(picker.dialog).toBeHidden();

    // Reopening starts at the new value.
    await picker.open();
    await expect(picker.option("Experiments", "Run 1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await picker.close();

    const submitRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/services/app-service/submit") &&
        request.method() === "POST",
    );
    await expect(page.getByRole("button", { name: /^submit$/i })).toBeEnabled();
    await form.submit(/^submit$/i);
    const payload = (await submitRequest).postDataJSON() as {
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_params).toMatchObject({ output_path: run1 });
  });

  test("works from the keyboard alone and returns focus to the field", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);

    await picker.browseButton.focus();
    await page.keyboard.press("Enter");
    await expect(picker.option("Home", "AMR Workshops")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(picker.option("Home", "Experiments")).toBeFocused();
    // → enters the first subfolder, which needs Experiments listed first.
    await expect(picker.option("Experiments", "Run 1")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(picker.option("Experiments", "Run 1")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(picker.dialog).toBeHidden();
    await expect(picker.browseButton).toBeFocused();
    await picker.open();
    await expect(picker.selectButton).toHaveAccessibleName("Select “Run 1”");
  });

  test("creates a folder inline and chooses it", async ({ page }) => {
    const { picker } = await openBlast(page, { reflectFolderCreates: true });
    await picker.open();
    await picker.option("Home", "Experiments").click();

    const create = page.waitForRequest(
      (request) => workspaceRpcMethod(request) === "Workspace.create",
    );
    await picker.dialog.getByRole("button", { name: "New folder here" }).click();
    await picker.dialog
      .getByRole("textbox", { name: "New folder name" })
      .fill("BLAST Results");
    await page.keyboard.press("Enter");

    const params = ((await create).postDataJSON() as { params: unknown[] })
      .params[0] as { objects: unknown[][] };
    expect(params.objects[0].slice(0, 2)).toEqual([
      `${experiments}/BLAST Results`,
      "Directory",
    ]);
    await expect(picker.option("Experiments", "BLAST Results")).toBeFocused();
    await expect(picker.option("Experiments", "BLAST Results")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(picker.selectButton).toHaveAccessibleName(
      "Select “BLAST Results”",
    );
  });

  test("uploads into the selected folder, and locks the picker while it runs", async ({
    page,
  }) => {
    const { picker } = await openBlast(page, { reflectUploads: true });
    await picker.open();
    await picker.option("Home", "Experiments").click();
    await picker.dialog.getByRole("button", { name: "Upload here" }).click();
    await expect(picker.dialog.getByText("Upload to “Experiments”")).toBeVisible();

    // Hold the multipart POST until the locked state has been checked. Routes
    // registered later run first, so this one wins over the default mock.
    const uploadHeld = Promise.withResolvers<undefined>();
    await page.route(/\/api\/services\/workspace\/upload/, async (route) => {
      await uploadHeld.promise;
      await route.fulfill({ json: { success: true, id: "upload-1" } });
    });
    await picker.dialog.locator('input[type="file"]').setInputFiles({
      name: "picked.fq",
      mimeType: "text/plain",
      buffer: Buffer.from("@r1\nACGT\n+\nFFFF\n"),
    });
    const upload = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/services/workspace/upload") &&
        request.method() === "POST",
    );
    await picker.dialog.getByRole("button", { name: "Start Upload" }).click();
    await upload;

    await expect(picker.closeButton).toBeDisabled();
    await expect(picker.cancelButton).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(picker.dialog).toBeVisible();

    uploadHeld.resolve(undefined);
    await expect(
      picker.dialog.getByRole("button", { name: "Upload here" }),
    ).toBeVisible();
    await expect(picker.closeButton).toBeEnabled();
    await picker.showFilesButton.click();
    await expect(picker.option("Experiments", /picked\.fq/)).toBeVisible();
  });
});

test.describe("output folder picker: layout", () => {
  test("lays the columns out at their default widths and resizes them by dragging", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);
    await picker.open();
    await picker.option("Home", "Experiments").click();
    await expect(picker.option("Experiments", "Run 1")).toBeVisible();

    expect(await picker.width(picker.columnAt(0))).toBe(240);
    expect(await picker.width(picker.columnAt(1))).toBe(180);

    await picker.dragHandle(picker.resizeHandle("Home"), 100);
    expect(await picker.width(picker.columnAt(0))).toBe(340);
    await expect(picker.resizeHandle("Home")).toHaveAttribute(
      "aria-valuenow",
      "340",
    );

    // Widths last between opens.
    await picker.close();
    await picker.open();
    expect(await picker.width(picker.columnAt(0))).toBe(340);

    await picker.resizeHandle("Home").dblclick();
    expect(await picker.width(picker.columnAt(0))).toBe(240);

    // The info pane is resized from its left edge: dragging left widens it.
    const before = await picker.width(
      picker.infoPaneHandle().locator("xpath=.."),
    );
    await picker.dragHandle(picker.infoPaneHandle(), -60);
    expect(
      await picker.width(picker.infoPaneHandle().locator("xpath=..")),
    ).toBe(before + 60);
  });

  test("keeps the newest column in view and the info pane pinned while going deeper", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);
    await picker.open();
    const pane = picker.infoPaneHandle().locator("xpath=..");
    const paneBefore = await pane.boundingBox();
    expect(await picker.scrollLeft()).toBe(0);

    await walkToLaneA(picker);
    await expect
      .poll(async () => picker.scrollLeft(), { timeout: 2_000 })
      .toBeGreaterThan(0);

    await picker.settled();
    const strip = await picker.strip.boundingBox();
    const newest = await picker.columnAt(3).boundingBox();
    expect(strip && newest).toBeTruthy();
    if (strip && newest) {
      expect(newest.x + newest.width).toBeLessThanOrEqual(
        strip.x + strip.width + 1,
      );
    }
    expect(await pane.boundingBox()).toEqual(paneBefore);

    // The footer spells out the whole path; nothing is cut short.
    expect(await picker.breadcrumbLabels()).toEqual([
      "Home",
      "Experiments",
      "Run 1",
      "Lane A",
    ]);
    const truncated = await picker.breadcrumb
      .locator("span.truncate")
      .evaluateAll((spans) =>
        spans.filter((span) => span.scrollWidth > span.clientWidth).length,
      );
    expect(truncated).toBe(0);

    // Back at the top, the strip scrolls home.
    await picker.breadcrumb.getByRole("button", { name: "Home" }).click();
    await expect.poll(async () => picker.scrollLeft()).toBe(0);
  });

  for (const { device, viewport } of [
    { device: "desktop", viewport: { width: 1280, height: 720 } },
    { device: "phone", viewport: { width: 375, height: 812 } },
  ]) {
    test(`keeps a deep path inside the footer, scrolled to the current folder (${device})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const { picker } = await openBlast(page, { pathItems: deepWorkspaceTree() });
      await picker.open();
      await picker.option("Home", campaign).click();
      let column = campaign;
      for (const name of deepFolders) {
        await picker.option(column, name).click();
        column = name;
      }
      await expect(picker.selectButton).toHaveAccessibleName(`Select “${column}”`);
      await picker.settled();

      const current = picker.breadcrumb.locator('[aria-current="location"]');
      await expect(current).toHaveText(column);
      const [dialog, trail, crumb, cancel, select] = await Promise.all([
        picker.dialog.boundingBox(),
        picker.breadcrumb.boundingBox(),
        current.boundingBox(),
        picker.cancelButton.boundingBox(),
        picker.selectButton.boundingBox(),
      ]);
      expect(dialog && trail && crumb && cancel && select).toBeTruthy();
      if (dialog && trail && crumb && cancel && select) {
        expect(trail.x).toBeGreaterThanOrEqual(dialog.x);
        expect(trail.x + trail.width).toBeLessThanOrEqual(dialog.x + dialog.width);
        // The current folder is in view, within the trail and clear of the
        // actions, however many folders come before it.
        expect(crumb.x).toBeGreaterThanOrEqual(trail.x - 1);
        expect(crumb.x + crumb.width).toBeLessThanOrEqual(trail.x + trail.width + 1);
        for (const action of [cancel, select]) {
          const overlaps =
            crumb.x < action.x + action.width &&
            action.x < crumb.x + crumb.width &&
            crumb.y < action.y + action.height &&
            action.y < crumb.y + crumb.height;
          expect(overlaps).toBe(false);
        }
      }

      // The start of the trail is still there to go back to.
      await picker.breadcrumb.getByRole("button", { name: "Home" }).click();
      await expect(current).toHaveText("Home");
    });
  }

  test("lines the close button up with the rest of the header", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);
    await picker.open();

    const close = await picker.closeButton.boundingBox();
    const showFiles = await picker.showFilesButton.boundingBox();
    const dialog = await picker.dialog.boundingBox();
    expect(close && showFiles && dialog).toBeTruthy();
    if (close && showFiles && dialog) {
      const middle = (box: { y: number; height: number }) =>
        box.y + box.height / 2;
      expect(Math.abs(middle(close) - middle(showFiles))).toBeLessThanOrEqual(1);
      expect(close.x).toBeGreaterThan(showFiles.x + showFiles.width);
      expect(close.x + close.width).toBeLessThanOrEqual(dialog.x + dialog.width);
    }
  });

  test("stacks the places and info pane around the columns on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const { picker } = await openBlast(page);
    await picker.open();
    await picker.option("Home", "Experiments").click();
    await expect(picker.option("Experiments", "Run 1")).toBeVisible();
    await picker.settled();

    const newFolder = picker.dialog.getByRole("button", {
      name: "New folder here",
    });
    const [dialog, places, strip, action] = await Promise.all([
      picker.dialog.boundingBox(),
      picker.places.boundingBox(),
      picker.strip.boundingBox(),
      newFolder.boundingBox(),
    ]);
    expect(dialog && places && strip && action).toBeTruthy();
    if (dialog && places && strip && action) {
      // The columns get the dialog's full width, between the places row and
      // the info pane, and the pane's actions are inside the dialog.
      expect(strip.width).toBeGreaterThanOrEqual(dialog.width - 1);
      expect(strip.height).toBeGreaterThan(160);
      expect(places.y + places.height).toBeLessThanOrEqual(strip.y + 1);
      expect(action.y).toBeGreaterThanOrEqual(strip.y + strip.height);
      expect(action.x).toBeGreaterThanOrEqual(dialog.x);
      expect(action.x + action.width).toBeLessThanOrEqual(
        dialog.x + dialog.width,
      );
    }
    await expect(picker.infoPaneHandle()).toBeHidden();

    // Every place is reachable from the scrolling row.
    await picker.places
      .getByRole("button", { name: "Public Workspaces" })
      .click();
    await expect(picker.column("Public Workspaces")).toBeVisible();

    // The upload form takes the whole body, and Back brings the columns back.
    await picker.places.getByRole("button", { name: "Home" }).click();
    await picker.option("Home", "Experiments").click();
    await picker.dialog.getByRole("button", { name: "Upload here" }).click();
    await expect(picker.dialog.getByText("Upload to “Experiments”")).toBeVisible();
    await expect(picker.strip).toBeHidden();
    await picker.dialog
      .getByRole("button", { name: "Back to folder info" })
      .click();
    await expect(picker.option("Experiments", "Run 1")).toBeVisible();

    await picker.option("Experiments", "Run 1").click();
    await expect(picker.selectButton).toHaveAccessibleName("Select “Run 1”");
    await picker.selectButton.click();
    await expect(picker.dialog).toBeHidden();
  });
});

test.describe("output folder picker: motion", () => {
  test("glides the scroll position and the scroll bar going in and out", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);
    await openAtLaneA(picker);
    await expect.poll(async () => picker.scrollLeft()).toBeGreaterThan(0);
    // Back out to Run 1 so the next step in needs the strip to scroll.
    await picker.option("Experiments", "Run 1").click();
    await picker.settled();
    await picker.option("Experiments", "Run 1").focus();

    const goingIn = await picker.pressAndTrace("ArrowRight");
    const inEnd = goingIn.scrollLeft.at(-1) ?? goingIn.before;
    expect(inEnd).toBeGreaterThan(goingIn.before);
    // It starts from where the strip was, not from the end.
    expect(goingIn.scrollLeft[0]).toBeLessThan(inEnd);
    expect(goingIn.scrollLeft[0]).toBeGreaterThanOrEqual(goingIn.before);
    // Intermediate positions: it glides rather than jumping.
    expect(new Set(goingIn.scrollLeft).size).toBeGreaterThan(2);
    expectMonotonic(goingIn.scrollLeft, 1);
    // The content width (the thumb's size) grows along with it, in steps.
    expect(new Set(goingIn.scrollWidth).size).toBeGreaterThan(2);
    expectMonotonic(goingIn.scrollWidth, 1);

    const goingOut = await picker.pressAndTrace("ArrowLeft");
    expect(goingOut.before).toBe(inEnd);
    expect(goingOut.scrollLeft[0]).toBeGreaterThan(goingOut.scrollLeft.at(-1) ?? 0);
    expect(goingOut.scrollLeft.at(-1)).toBeLessThan(inEnd);
    expect(new Set(goingOut.scrollLeft).size).toBeGreaterThan(2);
    expectMonotonic(goingOut.scrollLeft, -1);
    expect(new Set(goingOut.scrollWidth).size).toBeGreaterThan(2);
    expectMonotonic(goingOut.scrollWidth, -1);
    // The column that closed plays its exit on a copy, which is then removed.
    expect(goingOut.ghostsDuring).toBe(1);
    await expect(picker.exitCopies).toHaveCount(0);
  });

  test("leaves a scrolled strip where it is when moving within a column", async ({
    page,
  }) => {
    const { picker } = await openBlast(page);
    await openAtLaneA(picker);
    await expect.poll(async () => picker.scrollLeft()).toBeGreaterThan(0);
    // Let the glide to Lane A end first, or its last frame moves the strip back.
    await picker.settled();
    await picker.strip.evaluate((strip) => {
      strip.scrollLeft = 10;
    });

    const trace = await picker.pressAndTrace("ArrowDown");

    expect(trace.before).toBe(10);
    expect(new Set(trace.scrollLeft)).toEqual(new Set([10]));
    await expect(picker.selectButton).toHaveAccessibleName("Select “Lane B”");
  });

  test("jumps without animating when the user prefers reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { picker } = await openBlast(page);
    await openAtLaneA(picker);
    await picker.option("Experiments", "Run 1").click();
    await expect.poll(async () => picker.scrollLeft()).toBeGreaterThan(0);
    await picker.option("Experiments", "Run 1").focus();

    const trace = await picker.pressAndTrace("ArrowRight");

    // Already at its final place once committed, and never in between.
    expect(new Set(trace.scrollLeft).size).toBe(1);
    expect(trace.scrollLeft[0]).toBeGreaterThan(trace.before);
    expect(trace.ghostsDuring).toBe(0);
    // The reduced-motion rule in globals.css cuts CSS transitions to 0.01ms,
    // and WebKit lists one as running until it next draws, so only longer
    // animations (the columns' fades are 180ms) count.
    const running = await picker.dialog.evaluate(
      (dialog) =>
        dialog
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.playState === "running" &&
              Number(animation.effect?.getTiming().duration) > 1,
          ).length,
    );
    expect(running).toBe(0);
  });
});
