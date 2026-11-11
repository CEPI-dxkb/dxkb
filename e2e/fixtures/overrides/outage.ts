import type { BrowserContext } from "@playwright/test";

import {
  outageSessionToken,
  type SessionOutages,
} from "@/lib/e2e-fixtures/outages";
import type { JsonOverride } from "../../mocks/backends";
import { e2eUsername } from "./workspace";

// Specs reach the outage vocabulary through here: `src/lib/e2e-fixtures` may
// be imported only by this directory and the loopback.
export { outageRecords, type SessionOutages } from "@/lib/e2e-fixtures/outages";

/**
 * Signs in as `userId` with a session whose upstream calls fail as `outages`
 * says (e.g. `{ workspace: "maintenance" }`), leaving other tests on the same
 * server healthy. Replaces the signed-in storage state's cookies, so call it
 * before the first navigation.
 */
export async function signInDuringOutage(
  context: BrowserContext,
  baseURL: string | undefined,
  outages: SessionOutages,
  userId = e2eUsername,
): Promise<void> {
  if (!baseURL) throw new Error("baseURL must be configured");
  const cookie = {
    path: "/",
    domain: new URL(baseURL).hostname,
    httpOnly: true,
    secure: false,
    sameSite: "Strict" as const,
  };
  await context.addCookies([
    {
      ...cookie,
      name: "bvbrc_token",
      value: outageSessionToken(userId, outages),
    },
    { ...cookie, name: "bvbrc_user_id", value: userId },
    { ...cookie, name: "bvbrc_realm", value: "patricbrc.org" },
  ]);
}

/**
 * Same-origin routes an outage spec lets through to the app's route handler
 * so the server-side failure is what the page shows. Put a bundle first in
 * `overrides`, ahead of any healthy bundle for the same route
 * (`journeyOverrides` mocks all three).
 */
export const outagePassthroughOverrides = {
  workspace: [
    {
      url: /\/api\/services\/workspace(?:$|\?)/,
      method: "POST",
      passthrough: true,
    },
  ],
  jobs: [
    {
      url: /\/api\/services\/app-service\/jobs\/(?:enumerate-tasks-filtered|summary|task-summary)(?:$|\?)/,
      method: "POST",
      passthrough: true,
    },
  ],
  search: [{ url: /\/api\/data\/search(?:$|\?)/, method: "POST", passthrough: true }],
} satisfies Record<string, JsonOverride[]>;
