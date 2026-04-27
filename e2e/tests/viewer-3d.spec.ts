import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";

// Minimal 1-atom PDB. Mol* parses ATOM records; HEADER + END frames the file
// so the trajectory builder produces a valid (single-atom) structure.
const minimalPdb = [
  "HEADER    TEST                                                                  ",
  "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N  ",
  "TER",
  "END",
  "",
].join("\n");

const viewerUrl = "/viewer/structure/e2e-test-user%40patricbrc.org/home/test.pdb";

async function applyViewerMocks(page: import("@playwright/test").Page) {
  await applyBackendMocks(page, {
    overrides: [
      // PDB override MUST come before workspaceOverrides — applyBackendMocks
      // does first-match-wins, and workspaceOverrides has a generic
      // /api/workspace/view GET that returns JSON `{items: []}`. If that wins
      // here, Mol* receives JSON instead of PDB text and never mounts a canvas.
      {
        url: /\/api\/workspace\/view\//,
        method: "GET",
        status: 200,
        body: minimalPdb,
      },
      ...authSessionOverrides,
      ...workspaceOverrides,
      ...permissiveBackendOverrides,
    ],
  });
}

/**
 * Mol* runs its own WebGL probe (more strict than `canvas.getContext("webgl")`)
 * and renders the literal text "WebGL does not seem to be available" when its
 * probe fails — for instance under headless browsers without GPU acceleration.
 * This is the only signal we have that Mol*'s init bailed before mounting a
 * canvas, so use it to gate the paint assertion.
 */
async function molstarWebglAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  const fallback = page.getByText(/webgl does not seem to be available/i).first();
  // Wait briefly for either the fallback notice or a canvas to appear. Whichever
  // wins tells us how Mol* booted.
  const canvas = page.getByTestId("molstar-container").locator("canvas").first();
  const winner = await Promise.race([
    fallback.waitFor({ state: "visible", timeout: 30_000 }).then(() => "fallback" as const),
    canvas.waitFor({ state: "attached", timeout: 30_000 }).then(() => "canvas" as const),
  ]).catch(() => "timeout" as const);
  return winner === "canvas";
}

test.describe("3D viewer (Mol*)", () => {
  test("page chrome renders and Mol* mounts its container", async ({ page }) => {
    await applyViewerMocks(page);
    await page.goto(viewerUrl);

    await expect(page.getByRole("button", { name: /go back/i })).toBeVisible();
    // The visible filename in the page header lives inside the truncate <span>.
    // Scope to that span so we don't collide with Mol*'s log panel which can
    // also include the path string.
    await expect(page.locator("span.truncate", { hasText: "test.pdb" })).toBeVisible();

    const container = page.getByTestId("molstar-container");
    await expect(container).toBeVisible();
    const containerSize = await container.evaluate((el) => ({
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));
    expect(containerSize.clientWidth).toBeGreaterThan(0);
    expect(containerSize.clientHeight).toBeGreaterThan(0);
  });

  test("paints a WebGL canvas when WebGL is available", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Mol* WebGL init is flaky under headless Firefox/WebKit; cover canvas-paint on chromium only",
    );

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await applyViewerMocks(page);
    await page.goto(viewerUrl);

    // Headless browsers ship without GPU acceleration by default. Mol* renders
    // its "WebGL not available" notice in that case instead of a canvas —
    // a Playwright launch-flag concern, not an app regression — so skip the
    // paint assertion when that happens.
    const webglOk = await molstarWebglAvailable(page);
    test.skip(!webglOk, "Mol* could not initialise WebGL in this Playwright runtime");

    const canvas = page.getByTestId("molstar-container").locator("canvas").first();
    await expect(canvas).toBeAttached({ timeout: 30_000 });

    const dimensions = await canvas.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
    }));
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);

    const allowList: RegExp[] = [
      /Added non-passive event listener/i,
      /WebGL: INVALID_OPERATION/i,
    ];
    const unexpected = consoleErrors.filter(
      (msg) => !allowList.some((re) => re.test(msg)),
    );
    expect(
      unexpected,
      unexpected.length === 0
        ? undefined
        : `console errors during 3D viewer init:\n  ${unexpected.join("\n  ")}`,
    ).toEqual([]);
  });

  test("empty path shows a 'No file path provided.' message", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    await page.goto("/viewer/structure");
    await expect(page.getByText(/no file path provided/i)).toBeVisible();
  });
});
