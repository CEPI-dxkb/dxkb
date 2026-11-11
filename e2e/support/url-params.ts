import { expect, type Page } from "@playwright/test";

/**
 * Polls until the named query params hold the expected values (`null` =
 * absent); polled because Next applies History API writes in a transition and
 * the jobs search writes `q` after a 300 ms debounce.
 */
export async function expectUrlParams(
  page: Page,
  expected: Record<string, string | null>,
): Promise<void> {
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      return Object.fromEntries(
        Object.keys(expected).map((name) => [name, params.get(name)]),
      );
    })
    .toEqual(expected);
}
