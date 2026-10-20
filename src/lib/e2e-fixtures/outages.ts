/**
 * Backend outages the e2e loopback mock can answer with, and the two ways a
 * spec asks for one. Shared by the loopback
 * (`src/app/api/e2e-mock/[...path]/outage.ts`) and the specs
 * (through `e2e/fixtures/overrides/outage.ts`), so the name of an outage cannot drift between
 * the side that asks for it and the side that serves it.
 *
 * The Playwright workers share one Next server, so an outage can never be
 * global state: every worker would see it. Each one is carried by the
 * request it applies to instead:
 *
 * - **Session outage.** The session token carries an `e2e-outage=` field
 *   ({@link outageSessionToken}). Every upstream call made with that session
 *   forwards the token as `Authorization`, so the services it names fail for
 *   that test's requests only: the user (profile) service, the workspace and
 *   the app (job) service.
 * - **Record outage.** The Data API is read without a token in e2e (the
 *   loopback is plain HTTP and `ServerDataRepository` sends a token only over
 *   HTTPS, so the record views run signed out). A data request that names
 *   one of {@link outageRecords}' ids or keywords fails instead.
 *
 * Connect-level failures (refused, connect timeout) are not modelled: by the
 * time the loopback can read a request the connection has been accepted.
 * They stay covered by the MSW reproductions in
 * `src/test-helpers/upstream-failures.ts`.
 */

/**
 * - `maintenance`: an immediate 503 with BV-BRC's HTML maintenance page, as
 *   the services answered during the 2026-10-19 maintenance window.
 * - `hang`: the connection is accepted and never answered, so the caller's
 *   own budget has to end the wait (`E2E_UPSTREAM_BUDGET_MS` shortens the
 *   `fetchUpstream` budgets in e2e).
 */
export const outageShapes = ["maintenance", "hang"] as const;
export type OutageShape = (typeof outageShapes)[number];

/**
 * The services a session outage can name, each with the loopback namespaces
 * (the first path segment, one per `.env.e2e.test` URL) it covers.
 */
export const outageServiceNamespaces = {
  user: [
    "user",
    "user-auth",
    "user-register",
    "user-password-reset",
    "user-verification",
  ],
  workspace: ["workspace"],
  "app-service": ["app-service"],
  data: ["data", "data-service", "bvbrc-website"],
} as const satisfies Record<string, readonly string[]>;
export type OutageService = keyof typeof outageServiceNamespaces;

export type SessionOutages = Partial<Record<OutageService, OutageShape>>;

const directiveField = "e2e-outage=";
const entrySeparator = "+";

/**
 * A session token whose upstream calls fail as `outages` says, for the
 * `bvbrc_token` cookie. The `un=` claim keeps `userId` as the token's user.
 * Every character is a valid cookie octet, so the browser sends it back
 * unchanged.
 */
export function outageSessionToken(
  userId: string,
  outages: SessionOutages,
): string {
  const entries = Object.entries(outages).map(
    ([service, shape]) => `${service}:${shape}`,
  );
  if (entries.length === 0) {
    throw new Error("outageSessionToken needs at least one outage");
  }
  return `un=${userId}|${directiveField}${entries.join(entrySeparator)}|e2e-outage-token`;
}

export type OutageDirective =
  | { kind: "none" }
  | { kind: "outages"; outages: SessionOutages }
  | { kind: "invalid"; reason: string };

function isOutageService(value: string): value is OutageService {
  return Object.hasOwn(outageServiceNamespaces, value);
}

function isOutageShape(value: string): value is OutageShape {
  return (outageShapes as readonly string[]).includes(value);
}

/**
 * The outages an `Authorization` header asks for. Reads the token whatever
 * prefix a client put on it (`OAuth `, `Bearer `). An unknown service or
 * shape is `invalid` rather than ignored, so a typo in a spec fails loudly
 * instead of serving a healthy backend.
 */
export function parseOutageDirective(
  authorization: string | null,
): OutageDirective {
  if (!authorization) return { kind: "none" };
  const field = authorization
    .split("|")
    .map((part) => part.trim().replace(/^(?:OAuth|Bearer)\s+/i, ""))
    .find((part) => part.startsWith(directiveField));
  if (field === undefined) return { kind: "none" };
  const outages: SessionOutages = {};
  for (const entry of field.slice(directiveField.length).split(entrySeparator)) {
    const [service = "", shape = ""] = entry.split(":");
    if (!isOutageService(service)) {
      return {
        kind: "invalid",
        reason: `unknown outage service '${service}' in '${entry}' (one of ${Object.keys(outageServiceNamespaces).join(", ")})`,
      };
    }
    if (!isOutageShape(shape)) {
      return {
        kind: "invalid",
        reason: `unknown outage shape '${shape}' in '${entry}' (one of ${outageShapes.join(", ")})`,
      };
    }
    outages[service] = shape;
  }
  return { kind: "outages", outages };
}

/** The service a loopback path belongs to, by its first segment. */
export function outageServiceFor(path: string): OutageService | undefined {
  const namespace = path.split("/").find(Boolean) ?? "";
  return (Object.keys(outageServiceNamespaces) as OutageService[]).find(
    (service) =>
      (outageServiceNamespaces[service] as readonly string[]).includes(
        namespace,
      ),
  );
}

interface OutageRecordIds {
  /** A genome id the record page accepts (`/^\d+\.\d+$/`). */
  genomeId: string;
  /** A taxon id the taxonomy page accepts (a positive integer). */
  taxonId: string;
  /** One search term that survives keyword normalization unchanged. */
  keyword: string;
}

/**
 * Data records whose reads fail with each shape. No real BV-BRC record uses
 * these ids, and no healthy fixture in `./records.ts` does either.
 */
export const outageRecords = {
  maintenance: {
    genomeId: "990503.1",
    taxonId: "990503",
    keyword: "outagemaintenance",
  },
  hang: { genomeId: "990504.1", taxonId: "990504", keyword: "outagehang" },
} as const satisfies Record<OutageShape, OutageRecordIds>;

/**
 * The shape a data request asks for by naming an outage record anywhere in
 * its path, query or body. Matched as whole RQL terms, so `990503.1` does
 * not match the taxon `990503` and neither matches `1990503`.
 */
export function outageRecordShape(text: string): OutageShape | undefined {
  const terms = new Set(text.split(/[^\w.-]+/).filter(Boolean));
  return outageShapes.find((shape) =>
    Object.values(outageRecords[shape]).some((id) => terms.has(id)),
  );
}

/** BV-BRC's maintenance page, as `user.bv-brc.org` and `www.bv-brc.org` served it. */
export const maintenancePageHtml = `<!doctype html>
<title>Site Maintenance</title>
<style>
  body { text-align: center; padding: 150px; }
  h1 { font-size: 50px; }
  body { font: 20px Helvetica, sans-serif; color: #333; }
  article { display: block; text-align: left; width: 650px; margin: 0 auto; }
</style>
<article>
    <h1>We&rsquo;ll be back soon!</h1>
    <div>
        <p>Sorry for the inconvenience. Service will be back soon.</p>
    </div>
</article>`;

/** What `summarizeUpstreamBody` keeps of {@link maintenancePageHtml}. */
export const maintenanceSummary = "Site Maintenance — We’ll be back soon!";
