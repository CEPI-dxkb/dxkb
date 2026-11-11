import {
  uiPreferenceDefinitions,
  type UiPreferenceKey,
  type UiPreferences,
} from "./definitions";

const maxAgeSeconds = 60 * 60 * 24 * 365;

/** A `document.cookie` assignment for one preference; `encodeURIComponent` is right here since this is a cookie value, not a URL. */
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
