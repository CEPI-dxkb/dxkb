import type { Page } from "@playwright/test";

export type Theme = "dxkb-light" | "dxkb-dark";
export const allThemes: Theme[] = ["dxkb-light", "dxkb-dark"];

/**
 * Sets data-theme on <html> and waits out the color transition:
 * getComputedStyle reports the old theme's value until it ends, and axe reads
 * that (the reduced-motion rule in globals.css normally leaves nothing to
 * wait for).
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

export async function forEachTheme(
  page: Page,
  callback: (theme: Theme) => Promise<void>,
): Promise<void> {
  for (const theme of allThemes) {
    await setTheme(page, theme);
    await callback(theme);
  }
}
