const maxFileNameBaseLength = 200;

/**
 * A download's file name without its extension, safe on every desktop OS:
 * every character Windows or macOS refuses in a file name becomes `_`, leading
 * dots go (a dot file is hidden), a Windows device name (`CON`, `nul.x`,
 * `LPT1`) gains a leading `_`, and the result is cut to 200 characters. BRC
 * IDs carry a pipe (`fig|644340.17.peg.16`), so the replacement matters for
 * the commonest base. A trailing dot is left alone, since every caller appends
 * an extension. An empty result is the caller's to replace, because only the
 * caller knows what the file holds.
 */
export function safeFileNameBase(base: string): string {
  return base
    .trim()
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, "_")
    .replace(/^\.+/, "")
    .replace(/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?=\.|$)/i, "_$1")
    .slice(0, maxFileNameBaseLength);
}
