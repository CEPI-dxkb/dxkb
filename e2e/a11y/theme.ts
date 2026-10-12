import type { Page } from "@playwright/test";

export type Theme = "dxkb-light" | "dxkb-dark";
export const allThemes: Theme[] = ["dxkb-light", "dxkb-dark"];

/**
 * Apply a theme by setting data-theme on <html>, then wait out any CSS
 * transition the switch started. Custom properties change synchronously, but
 * an element whose color transitions reports the old theme's value from
 * getComputedStyle until the transition ends, and axe reads that. The
 * reduced-motion rule in globals.css leaves no transition to run, so the wait
 * is normally empty; it once let ~6000 run, which CI's WebKit had not
 * finished a second later, failing color-contrast across the whole page.
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate(async (t: string) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.classList.remove("dxkb-light", "dxkb-dark");
    document.documentElement.classList.add(t);
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  }, theme);
}

/**
 * Run a scan callback once per theme (light → dark).
 *
 *   await forEachTheme(page, async (theme) => {
 *     const violations = await scanPage(page);
 *     // assert ...
 *   });
 */
export async function forEachTheme(
  page: Page,
  callback: (theme: Theme) => Promise<void>,
): Promise<void> {
  for (const theme of allThemes) {
    await setTheme(page, theme);
    await callback(theme);
  }
}
