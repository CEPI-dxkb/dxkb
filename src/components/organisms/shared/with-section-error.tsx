import type { ReactElement } from "react";

import { SectionError } from "./section-error";

/**
 * Renders a server section, or its error with a Retry when its load throws.
 * The reason is rendered rather than rethrown: production redacts a thrown
 * server-component error to a digest, so a boundary could not say why.
 */
export async function withSectionError(
  load: () => Promise<ReactElement>,
): Promise<ReactElement> {
  try {
    return await load();
  } catch (error) {
    return <SectionError error={error} />;
  }
}
