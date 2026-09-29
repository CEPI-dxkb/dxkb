import "server-only";
import { cookies } from "next/headers";
import { parseUiPreferences } from "./cookie";
import type { UiPreferences } from "./definitions";

/**
 * Every UI preference from the request cookies. The root layout already reads the
 * session cookies, so every route is dynamic and this adds no rendering cost.
 */
export async function readUiPreferences(): Promise<UiPreferences> {
  const store = await cookies();
  return parseUiPreferences((name) => store.get(name)?.value);
}
