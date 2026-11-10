import { expect, type Locator } from "@playwright/test";

/**
 * Waits until React has attached `handler` (`"onClick"`, ...) on every
 * matched element (`__reactProps$<id>`). A server-rendered control is visible
 * earlier, and a click or typed value in that window is lost.
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
