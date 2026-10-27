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
 */
export async function withSectionError(
  section: string,
  load: () => Promise<ReactElement>,
): Promise<ReactElement> {
  try {
    return await load();
  } catch (error) {
    console.error(`[overview] ${section} could not be loaded:`, error);
    return <SectionError section={section} error={error} />;
  }
}
