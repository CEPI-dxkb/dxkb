/**
 * Backend outages the e2e loopback mock can answer with, shared by the loopback and the specs so an outage's name cannot drift.
 * Workers share one Next server, so an outage rides on the request: a session token's `e2e-outage=` field ({@link outageSessionToken}) fails the user, workspace and job services for that test only, and a data request naming an {@link outageRecords} id or keyword fails the token-less Data API. Connect-level failures are not modelled (see `src/test-helpers/upstream-failures.ts`).
 */

/**
 * `maintenance`: an immediate 503 with BV-BRC's HTML maintenance page.
 * `hang`: the connection is accepted and never answered, so the caller's own budget ends the wait.
 */
export const outageShapes = ["maintenance", "hang"] as const;
export type OutageShape = (typeof outageShapes)[number];

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

/** A session token for the `bvbrc_token` cookie whose upstream calls fail as `outages` says; every character is a valid cookie octet. */
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

/** Reads the token whatever prefix it carries; an unknown service or shape is `invalid` rather than ignored, so a spec typo fails loudly. */
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
  genomeId: string;
  taxonId: string;
  keyword: string;
}

/** No real BV-BRC record or healthy fixture uses these ids. */
export const outageRecords = {
  maintenance: {
    genomeId: "990503.1",
    taxonId: "990503",
    keyword: "outagemaintenance",
  },
  hang: { genomeId: "990504.1", taxonId: "990504", keyword: "outagehang" },
} as const satisfies Record<OutageShape, OutageRecordIds>;

/** Matched as whole RQL terms, so `990503.1` does not match taxon `990503`. */
export function outageRecordShape(text: string): OutageShape | undefined {
  const terms = new Set(text.split(/[^\w.-]+/).filter(Boolean));
  return outageShapes.find((shape) =>
    Object.values(outageRecords[shape]).some((id) => terms.has(id)),
  );
}

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

export const maintenanceSummary = "Site Maintenance — We’ll be back soon!";
