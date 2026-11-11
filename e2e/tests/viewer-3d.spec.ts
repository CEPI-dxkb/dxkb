import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  emptyBackendFallbackOverrides,
} from "../fixtures/overrides";

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
      // The PDB override must precede workspaceOverrides: first match wins and its
      // generic /api/workspace/view GET returns JSON, so Mol* would never mount a
      // canvas.
      {
        url: /\/api\/workspace\/view\//,
        method: "GET",
        status: 200,
        body: minimalPdb,
      },
      ...authSessionOverrides,
      ...workspaceOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
}

async function molstarWebglAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  const fallback = page.getByText(/webgl does not seem to be available/i).first();
  const canvas = page.getByTestId("molstar-container").locator("canvas").first();
  const winner = await Promise.race([
    fallback.waitFor({ state: "visible", timeout: 30_000 }).then(() => "fallback" as const),
    canvas.waitFor({ state: "attached", timeout: 30_000 }).then(() => "canvas" as const),
  ]).catch(() => "timeout" as const);
  return winner === "canvas";
}

test.describe("3D viewer (Mol*)", () => {
  test("requests the workspace file at a singly encoded path", async ({ page }) => {
    // The catch-all route param arrives percent-encoded and
    // `buildWorkspaceStructureSource` encodes again, so forwarding raw segments
    // double-encoded the URL; URL-agnostic mocks in other specs cannot see it.
    const viewRequest = page.waitForRequest((request) =>
      request.url().includes("/api/workspace/view/"),
    );
    await applyViewerMocks(page);
    await page.goto(viewerUrl);

    expect(new URL((await viewRequest).url()).pathname).toBe(
      "/api/workspace/view/e2e-test-user%40patricbrc.org/home/test.pdb",
    );
  });

  test("page chrome renders and Mol* mounts its container", async ({ page }) => {
    await applyViewerMocks(page);
    await page.goto(viewerUrl);

    await expect(page.getByRole("button", { name: /go back/i })).toBeVisible();
    // Scope to the truncate span; Mol*'s log panel can also contain the path.
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

    // Headless browsers lack GPU acceleration, so Mol* shows its notice instead of a
    // canvas; skip the paint assertion then.
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
        ...emptyBackendFallbackOverrides,
      ],
    });
    await page.goto("/viewer/structure");
    await expect(page.getByText(/no file path provided/i)).toBeVisible();
  });
});
