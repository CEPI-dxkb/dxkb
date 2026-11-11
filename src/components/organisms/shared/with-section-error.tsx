import type { ReactElement } from "react";

import { SectionError } from "./section-error";

/**
 * Renders a server section, or its error with a Retry when its load throws. The
 * reason is rendered, not rethrown, because production redacts a thrown
 * server-component error to a digest.
 *
 * SectionError gets the message, not the error: in development React cannot
 * serialize an error whose cause has no stack frame outside Node internals, and
 * the browser throws "frame.join is not a function" (fixed on React main, not in
 * Next 16.4.3).
 */
export async function withSectionError(
  section: string,
  load: () => Promise<ReactElement>,
): Promise<ReactElement> {
  try {
    return await load();
  } catch (error) {
    console.error(`[overview] ${section} could not be loaded:`, error);
    const message = error instanceof Error ? error.message : error;
    return <SectionError section={section} error={message} />;
  }
}
