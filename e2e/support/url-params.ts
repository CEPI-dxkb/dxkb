import { expect, type Page } from "@playwright/test";

/**
 * Poll the address bar until the named query params hold the expected values (`null` means
 * the param is absent). Only the named params are compared, so a test can pin the ones it
 * cares about and ignore the rest.
 *
 * Polls because the address is written asynchronously: Next applies History API writes inside
 * a transition, and the jobs search box writes `q` only after its 300 ms debounce. A single
 * read right after an action can see the previous address.
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
