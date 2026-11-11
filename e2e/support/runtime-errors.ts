import { expect, type Page } from "@playwright/test";

/**
 * Fails the journey on a hydration mismatch or unhandled error. Call before
 * the first navigation and the returned assertion at the end; stricter than
 * the copy in workspace-browse.spec.ts, which lets a mocked 500 through.
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
