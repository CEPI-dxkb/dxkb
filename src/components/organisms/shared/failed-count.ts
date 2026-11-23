function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * A failed tile's description (its tooltip and screen-reader text): the
 * tile's own, then why its count could not load and how to retry, so the
 * reason stays findable without an error text on the page.
 */
export function failedCountDescription(
  description: string,
  reason: string,
): string {
  return `${asSentence(description)} Could not load: ${asSentence(reason)} Click Unavailable to retry.`;
}
