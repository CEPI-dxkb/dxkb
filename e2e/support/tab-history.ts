import type { Page, Request } from "@playwright/test";

// Back or Forward from a server-rendered tab renders the leaving tab one more
// time against the destination's URL: React flushes the popstate transition at
// sync priority, Next's InnerLayoutRouter keeps the previous page RSC for that
// commit (useDeferredValue), and useSearchParams() already returns the new URL.
// A collection in that frame used to drop its filter or page, show "Loading
// results..." and fetch rows for a URL that is not its own. The tab shells hold
// the content on the search it was rendered for (TabContentSearchParams).
// Only a browser reproduces the timing, so the specs that use these helpers
// watch every frame and every Data API read around the history step.

/** What one animation frame shows. */
export interface Frame {
  search: string;
  /** Label of the view rail's `aria-current` tab. */
  current: string;
  loading: boolean;
  /** The table's "Showing X-Y of Z" summary, if one is on screen. */
  summary: string | null;
}

/**
 * Push `href` through the app router, as a tab or chart link does. The page must have hydrated.
 * `window.next.router` is Next's public router instance, exposed for debugging.
 */
export async function routerPush(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const { next } = window as unknown as {
      next: { router: { push: (href: string) => void } };
    };
    next.router.push(target);
  }, href);
}

/**
 * Take a history step and sample every frame until the rail has shown `destination` as the
 * current tab for half a second. The sampler starts in the same evaluate as the step, so it
 * sees the first frame after the popstate.
 */
export async function stepAndSampleFrames(
  page: Page,
  step: "back" | "forward",
  destination: string,
): Promise<Frame[]> {
  return page.evaluate(
    ({ step, destination }) =>
      new Promise<Frame[]>((resolve) => {
        const frames: Frame[] = [];
        const start = performance.now();
        let arrivedAt: number | null = null;
        const sample = () => {
          const now = performance.now();
          const current =
            document
              .querySelector('nav[aria-label$=" views"] [aria-current="page"]')
              ?.textContent.trim() ?? "";
          const text = document.body.innerText;
          frames.push({
            search: location.search,
            current,
            loading: text.includes("Loading results..."),
            summary:
              /Showing [\d,]+-[\d,]+ of [\d,]+/.exec(text)?.[0] ?? null,
          });
          if (current !== destination) arrivedAt = null;
          else arrivedAt ??= now;
          const settled = arrivedAt !== null && now - arrivedAt >= 500;
          if (settled || now - start >= 5_000) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        if (step === "back") history.back();
        else history.forward();
      }),
    { step, destination },
  );
}

/** Data API collection reads of `resource` made while `action` runs. */
export async function collectionReads(
  page: Page,
  resource: string,
  action: () => Promise<void>,
): Promise<URL[]> {
  const reads: URL[] = [];
  const record = (request: Request) => {
    const url = new URL(request.url());
    if (
      url.pathname === `/api/data/${resource}` &&
      url.searchParams.get("operation") === "collection"
    ) {
      reads.push(url);
    }
  };
  page.on("request", record);
  try {
    await action();
  } finally {
    page.off("request", record);
  }
  return reads;
}
