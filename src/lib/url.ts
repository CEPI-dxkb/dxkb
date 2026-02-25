/**
 * Safely decode a URI component, returning the original string
 * if it contains malformed percent-encoded sequences.
 */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
