import type { Page, TestInfo } from "@playwright/test";

/** One entry of the page's focus trail. */
interface FocusStep {
  /** ms since the page's navigation start. */
  at: number;
  event: "focusin" | "focusout" | "keydown" | "window-blur" | "window-focus";
  /** The element the event is about, or the key pressed. */
  target: string;
  /** focusin/focusout: the other side of the move; "(none)" is the body. */
  related: string;
}

type TrailWindow = Window & {
  e2eFocusTrail?: FocusStep[];
  e2eDescribeFocus?: (node: EventTarget | null) => string;
};

/**
 * Records every focus change, key press and window focus change in the page,
 * so a failed focus assertion says where focus went and when it left.
 *
 * WebKit restarts Tab navigation from the top of the document once focus is
 * blurred to the body, where Chromium and Firefox continue from the element
 * that lost it. So a stray blur shows up only in WebKit, as "Tab went to the
 * header", with nothing else in the trace to say why. Call before the first
 * navigation; it re-installs on every navigation.
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

/** On a failed test: attaches the focus trail and the element focus ended on. */
export async function attachFocusTrail(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
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
