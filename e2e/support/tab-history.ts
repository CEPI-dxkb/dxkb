import type { Page, Request } from "@playwright/test";

// Back or Forward from a server-rendered tab renders the leaving tab once
// more against the destination's URL (popstate flushes at sync priority while
// Next keeps the previous RSC), so a collection could drop its filter or
// page. Only a browser reproduces the timing, so these helpers sample every
// frame and Data API read around the step.

export interface Frame {
  search: string;
  current: string;
  loading: boolean;
  summary: string | null;
}

export async function routerPush(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const { next } = window as unknown as {
      next: { router: { push: (href: string) => void } };
    };
    next.router.push(target);
  }, href);
}

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
