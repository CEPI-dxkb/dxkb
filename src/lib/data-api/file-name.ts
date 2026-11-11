const maxFileNameBaseLength = 200;

/**
 * Every character Windows or macOS refuses becomes `_`, leading dots go, a
 * Windows device name gains a leading `_`, and the result is cut to 200
 * characters.
 * A trailing dot is left alone and an empty result is the caller's to replace.
 */
export function safeFileNameBase(base: string): string {
  return base
    .trim()
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, "_")
    .replace(/^\.+/, "")
    .replace(/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?=\.|$)/i, "_$1")
    .slice(0, maxFileNameBaseLength);
}
