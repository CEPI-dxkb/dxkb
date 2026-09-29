import { expect, type Page } from "@playwright/test";

/**
 * A hydration mismatch or an unhandled error must fail the journey, not scroll past
 * in the console. Call it before the first navigation and the returned assertion at
 * the end; each call attaches its own listeners. Stricter than the copy in
 * workspace-browse.spec.ts, which lets a mocked 500 through.
 */
export function failOnRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return () => {
    expect(errors, "page emitted runtime errors").toEqual([]);
  };
}
