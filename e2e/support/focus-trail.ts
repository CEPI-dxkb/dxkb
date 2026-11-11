import type { Page, TestInfo } from "@playwright/test";

interface FocusStep {
  at: number;
  event: "focusin" | "focusout" | "keydown" | "window-blur" | "window-focus";
  target: string;
  related: string;
}

type TrailWindow = Window & {
  e2eFocusTrail?: FocusStep[];
  e2eDescribeFocus?: (node: EventTarget | null) => string;
};

/**
 * Records focus changes, key presses and window focus changes so a failed
 * focus assertion says where focus went. WebKit restarts Tab from the
 * document top after a blur to the body, so a stray blur shows up only there.
 * Call before the first navigation; it re-installs on each one.
 */
export async function recordFocusTrail(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const trailWindow = window as TrailWindow;
    const describe = (node: EventTarget | null): string => {
      if (node === null) return "(none)";
      if (!(node instanceof Element)) return "(document)";
      const label =
        node.getAttribute("aria-label") ?? node.textContent.trim().slice(0, 40);
      const row = node.getAttribute("data-row");
      const gene =
        row === null
          ? ""
          : ` [row ${row}, feature ${node.getAttribute("data-feature") ?? "?"}]`;
      return `${node.tagName.toLowerCase()} "${label}"${gene}`;
    };
    const trail: FocusStep[] = [];
    trailWindow.e2eFocusTrail = trail;
    trailWindow.e2eDescribeFocus = describe;
    const at = () => Math.round(performance.now());
    for (const event of ["focusin", "focusout"] as const) {
      document.addEventListener(
        event,
        (focusEvent) => {
          trail.push({
            at: at(),
            event,
            target: describe(focusEvent.target),
            related: describe(focusEvent.relatedTarget),
          });
        },
        true,
      );
    }
    document.addEventListener(
      "keydown",
      (keyEvent) => {
        trail.push({
          at: at(),
          event: "keydown",
          target: keyEvent.key,
          related: "",
        });
      },
      true,
    );
    window.addEventListener("blur", () => {
      trail.push({ at: at(), event: "window-blur", target: "", related: "" });
    });
    window.addEventListener("focus", () => {
      trail.push({ at: at(), event: "window-focus", target: "", related: "" });
    });
  });
}

/**
 * Attaches the focus trail on failure; `force` attaches it even while the
 * status still reads as expected.
 */
export async function attachFocusTrail(
  page: Page,
  testInfo: TestInfo,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  if (!force && testInfo.status === testInfo.expectedStatus) return;
  const report = await page
    .evaluate(() => {
      const trailWindow = window as TrailWindow;
      return {
        trail: trailWindow.e2eFocusTrail ?? [],
        active: trailWindow.e2eDescribeFocus?.(document.activeElement) ?? "",
        hasFocus: document.hasFocus(),
      };
    })
    .catch(() => null);
  if (!report) return;
  await testInfo.attach("focus-trail", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  const lines = report.trail.map(
    (step) =>
      `${String(step.at)}ms ${step.event} ${step.target}${step.related ? ` (related: ${step.related})` : ""}`,
  );
  console.info(
    `[focus-trail] ${testInfo.title}: focus ended on ${report.active} (document.hasFocus() = ${String(report.hasFocus)})\n${lines.join("\n")}`,
  );
}
