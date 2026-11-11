import "server-only";
import { cookies } from "next/headers";
import { parseUiPreferences } from "./schemas";
import type { UiPreferences } from "./definitions";

/** Every UI preference from the request cookies. */
export async function readUiPreferences(): Promise<UiPreferences> {
  const store = await cookies();
  return parseUiPreferences((name) => store.get(name)?.value);
}
