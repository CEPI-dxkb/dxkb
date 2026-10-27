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
 * Sign the context in as `userId` with a session whose upstream calls fail as
 * `outages` says: `{ workspace: "maintenance" }` makes every Workspace call
 * this test's server-side requests make answer BV-BRC's 503 maintenance page,
 * while other tests on the same server keep a healthy backend. How the
 * loopback reads it: `src/lib/e2e-fixtures/outages.ts`.
 *
 * Replaces the default signed-in storage state's cookies (same names, domain
 * and path), so call it before the first navigation.
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
 * Same-origin routes an outage spec lets through to the app's own route
 * handler, so the server-side half of the failure — the route's upstream call,
 * the loopback's outage answer (`src/app/api/e2e-mock/[...path]/outage.ts`)
 * and the route's mapping of it to `{error, code}` — is what the page shows.
 * Mocking these in the browser would assert only the client's rendering of a
 * response the spec wrote itself.
 *
 * Put a bundle FIRST in `overrides` (first match wins), ahead of any healthy
 * bundle that mocks the same route (`journeyOverrides` mocks all three).
 */
export const outagePassthroughOverrides = {
  /** The Workspace JSON-RPC proxy behind the workspace browser. */
  workspace: [
    {
      url: /\/api\/services\/workspace(?:$|\?)/,
      method: "POST",
      passthrough: true,
    },
  ],
  /** The jobs list and the summary behind both `/jobs` and the header's job pill. */
  jobs: [
    {
      url: /\/api\/services\/app-service\/jobs\/(?:enumerate-tasks-filtered|summary)(?:$|\?)/,
      method: "POST",
      passthrough: true,
    },
  ],
  /** The all-data-types search behind `/search?q=…`. */
  search: [{ url: /\/api\/data\/search(?:$|\?)/, method: "POST", passthrough: true }],
} satisfies Record<string, JsonOverride[]>;
