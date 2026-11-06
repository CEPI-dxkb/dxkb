import {
  uiPreferenceDefinitions,
  type UiPreferenceKey,
  type UiPreferences,
} from "./definitions";

const maxAgeSeconds = 60 * 60 * 24 * 365;

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
