import { expect, type Locator } from "@playwright/test";

/**
 * Waits until React has hydrated every element `elements` matches (at least
 * one), shown by `handler` (`"onClick"`, `"onChange"`, ...) being attached.
 *
 * A server-rendered control is visible before React attaches its handlers,
 * and input in that window is lost: a click does nothing, and a typed value
 * is reset to the form's state as the control hydrates. React attaches a
 * hydrated element's props as `__reactProps$<id>`.
 */
export async function expectHydrated(
  elements: Locator,
  handler: string,
  message: string,
): Promise<void> {
  await expect
    .poll(
      () =>
        elements.evaluateAll(
          (nodes, name) =>
            nodes.length > 0 &&
            nodes.every((node) =>
              Object.entries(node).some(
                ([key, props]) =>
                  key.startsWith("__reactProps$") &&
                  typeof (props as Record<string, unknown> | null)?.[name] ===
                    "function",
              ),
            ),
          handler,
        ),
      { message },
    )
    .toBe(true);
}
