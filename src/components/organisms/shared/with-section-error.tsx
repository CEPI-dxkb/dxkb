import type { ReactElement } from "react";

import { SectionError } from "./section-error";

/**
 * Renders a server section, or its error with a Retry when its load throws.
 * The reason is rendered rather than rethrown: production redacts a thrown
 * server-component error to a digest, so a boundary could not say why.
 *
 * `section` names it in the error's title ("Reference genomes could not be
 * loaded"). The error is also logged, since nothing else reports a caught
 * one: an `UpstreamError` prints its `host` there, which the user's message
 * leaves out.
 *
 * SectionError gets the message, not the error. In development React sends
 * every server component's props to the browser, and it cannot send an error
 * whose cause has no stack frame outside Node internals (the `TimeoutError` of
 * an upstream budget, undici's socket error): it omits that cause's stack, the
 * browser throws "frame.join is not a function" reviving it, and the route's
 * error boundary replaces the whole page. React's fix (`objectLimit:
 * stack.length * 2 + 2` in `serializeDebugErrorValue`) is on its main branch
 * but not in Next 16.4.3.
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
