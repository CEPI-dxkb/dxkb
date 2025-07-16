// Safe URL decoding utility - can be used in both client and server contexts
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn("Failed to decode cookie value:", error);
    return value; // Return original value if decoding fails
  }
}
