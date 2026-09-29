import {
  mapUiPreferences,
  uiPreferenceDefinitions,
  type UiPreferenceKey,
  type UiPreferences,
} from "./definitions";

const maxAgeSeconds = 60 * 60 * 24 * 365;

/** Parse one cookie value; anything absent, malformed or out of schema is the default. */
export function parseUiPreference<K extends UiPreferenceKey>(
  key: K,
  raw: string | undefined,
): UiPreferences[K] {
  const { schema, defaultValue } = uiPreferenceDefinitions[key];
  if (raw === undefined) return defaultValue;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return defaultValue;
  }
  const result = schema.safeParse(decoded);
  return result.success ? result.data : defaultValue;
}

export function parseUiPreferences(
  readCookie: (name: string) => string | undefined,
): UiPreferences {
  return mapUiPreferences((key) =>
    parseUiPreference(key, readCookie(uiPreferenceDefinitions[key].cookieName)),
  );
}

/**
 * A `document.cookie` assignment for one preference. This is a cookie value, not a
 * URL, so `encodeURIComponent` is the right escaping (the readable-URL helpers in
 * src/lib/url.ts do not apply); Next's `cookies()` decodes it on the way back in.
 */
export function serializeUiPreferenceCookie<K extends UiPreferenceKey>(
  key: K,
  value: UiPreferences[K],
  { secure }: { secure: boolean },
): string {
  const parts = [
    `${uiPreferenceDefinitions[key].cookieName}=${encodeURIComponent(JSON.stringify(value))}`,
    "Path=/",
    `Max-Age=${String(maxAgeSeconds)}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
